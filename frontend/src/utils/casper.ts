import {
    PublicKey,
    Args,
    CLValue,
    ContractCallBuilder,
    Transaction,
    SessionBuilder,
    Deploy,
    DeployHeader,
    ExecutableDeployItem,
    Duration,
    ModuleBytes,
    StoredContractByHash,
    Contract,
    RpcClient,
    HttpHandler,
    Key, // Use Key instead of CLKey
    KeyTypeID,
    AccountHash, // Use AccountHash
    // CLPublicKey,
    // CLByteArray,
    CLTypeUInt8,
    ContractHash,
    StoredVersionedContractByHash,
    Approval,
    Timestamp,
    // Add other types as needed
} from 'casper-js-sdk';
import blake from 'blakejs';
import { RequestQueue, QueueTask, QueueProgress } from './requestQueue';
import { SyncProgress } from './syncProgress';

const DEFAULT_DEPOSIT_PAYMENT_MOTES = 150_000_000_000n;
const DEFAULT_WITHDRAW_PAYMENT_MOTES = 300_000_000_000n;

// Use proxy to avoid CORS in browser
const NODE_URL = typeof window !== 'undefined' ? '/api/proxy' : 'https://node.testnet.casper.network/rpc';

// Helper to make raw RPC calls
const rpcCall = async (method: string, params: any) => {
    // Use local proxy to avoid CORS
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: new Date().getTime(),
            method,
            params
        }),
    });
    const data = await response.json();
    if (data.error) {
        console.error('[rpcCall] RPC error for method', method, ':', JSON.stringify(data.error));
        throw new Error(data.error.message);
    }
    return data.result;
};

// Helper: Convert bytes/Hash to hex
const toHex = (bytes: Uint8Array | any): string => {
    if (!bytes) return '';
    if (typeof bytes === 'string') return bytes;
    if (bytes.toHex) return bytes.toHex();
    if (bytes instanceof Uint8Array || (bytes.buffer && bytes.length !== undefined)) {
        return Buffer.from(bytes).toString('hex');
    }
    return String(bytes);
};

// Helper to compute dictionary key
function getDictionaryItemKey(urefStr: string, index: number, mode: number = 0): string {
    const parts = urefStr.split('-');
    const urefHex = parts[1];
    const rightsVal = parseInt(parts[2], 8);

    // decodeBase16 replacement
    const urefBytes = new Uint8Array(Buffer.from(urefHex, 'hex'));
    const rightsByte = new Uint8Array([rightsVal]);

    // Key Bytes
    const keyBuf4 = new Uint8Array(4); // u32 LE
    new DataView(keyBuf4.buffer).setUint32(0, index, true);

    // Tagged Key (CLValue tag for U32 is 4)
    const keyBufTag = new Uint8Array(5);
    keyBufTag[0] = 4;
    keyBufTag.set(keyBuf4, 1);

    const indexStr = index.toString();
    const keyBufString = new TextEncoder().encode(indexStr);

    let seed: Uint8Array;
    let key: Uint8Array;

    // Modes based on my brute force strategy
    if (mode === 0) {
        seed = new Uint8Array([...urefBytes, ...rightsByte]);
        key = keyBuf4;
    }
    else if (mode === 1) {
        seed = urefBytes;
        key = keyBuf4;
    }
    else if (mode === 2) {
        seed = new Uint8Array([...urefBytes, ...rightsByte]);
        key = keyBufTag;
    }
    else {
        seed = urefBytes;
        key = keyBufString;
    }

    const ctx = blake.blake2bInit(32);
    blake.blake2bUpdate(ctx, seed);
    blake.blake2bUpdate(ctx, key);
    return Buffer.from(blake.blake2bFinal(ctx)).toString('hex');
}

// Helper: Convert CLValue to Legacy JSON format { cl_type, bytes, parsed }
const toLegacyCLValueJson = (clValue: CLValue | any): any => {
    if (!clValue) return null;

    // Already in legacy format
    if (clValue?.cl_type && clValue?.bytes !== undefined) return clValue;

    const typeName = clValue?.type?.typeName;

    const getBytes = (): Uint8Array => {
        if (typeof clValue.bytes === 'function') {
            return clValue.bytes();
        }
        // Fallback for some v5 objects that might have changed internal structure
        if (clValue.data) return clValue.data;
        return new Uint8Array(0);
    };

    // Handle numeric types (U8, U32, U64, U128, U256, U512)
    if (typeName && ['U8', 'U32', 'U64', 'U128', 'U256', 'U512'].includes(typeName)) {
        return {
            cl_type: typeName,
            bytes: toHex(getBytes()),
            parsed: clValue.toString()
        };
    }

    // Handle ByteArray
    if (clValue?.type?.size !== undefined) {
        return {
            cl_type: { ByteArray: clValue.type.size },
            bytes: toHex(getBytes()),
            parsed: toHex(getBytes())
        };
    }

    // Handle PublicKey
    if (typeName === 'PublicKey' || clValue?.toHex) {
        const hex = clValue.toHex ? clValue.toHex() : toHex(getBytes());
        return {
            cl_type: 'PublicKey',
            bytes: hex,
            parsed: hex
        };
    }

    // Handle Key type
    if (typeName === 'Key') {
        const bytes = getBytes();
        return {
            cl_type: 'Key',
            bytes: toHex(bytes),
            parsed: clValue.toString ? clValue.toString() : toHex(bytes)
        };
    }

    // Handle List (typeName may be 'List', 'List<U8>', etc. in SDK v5)
    if (typeName === 'List' || typeName?.startsWith('List') || clValue?.type?.inner) {
        const listData = clValue.data || (typeof clValue.value === 'function' ? clValue.value() : []) || [];
        const innerTypeName = clValue.type?.inner?.typeName || clValue.type?.elementType?.typeName || 'U8';
        return {
            cl_type: { List: innerTypeName },
            bytes: toHex(getBytes()),
            parsed: Array.isArray(listData) ? listData.map((item: any) => toLegacyCLValueJson(item)) : listData
        };
    }

    // Handle String
    if (typeName === 'String') {
        return {
            cl_type: 'String',
            bytes: toHex(getBytes()),
            parsed: clValue.toString()
        };
    }

    // Handle Boolean
    if (typeName === 'Bool') {
        return {
            cl_type: 'Bool',
            bytes: toHex(getBytes()),
            parsed: clValue.toString() === 'true'
        };
    }

    // Fallback: try toJSON if available (SDK v5 may use different casing)
    if (typeof clValue.toJSON === 'function') {
        const json = clValue.toJSON();
        if (json && json.cl_type) return json;
        if (json && (json.CLType || json.clType)) {
            return {
                cl_type: json.CLType || json.clType,
                bytes: json.Bytes || json.bytes || '',
                parsed: json.Parsed || json.parsed || null
            };
        }
    }

    // Robust fallback: construct legacy format from bytes() and type.toString()
    if (typeof clValue.bytes === 'function') {
        const bytes = clValue.bytes();
        if (bytes && bytes.length > 0) {
            let clType: any = typeName || 'Any';
            const typeStr = clValue.type?.toString?.();
            if (typeStr) {
                // Parse compound types: "List(U8)", "(List of U8)", etc. → { List: "U8" }
                const listMatch = typeStr.match(/List\s*(?:\(|of\s+)(\w+)/i);
                if (listMatch) {
                    clType = { List: listMatch[1] };
                } else if (typeStr !== '[object Object]') {
                    clType = typeStr;
                }
            }
            return {
                cl_type: clType,
                bytes: toHex(bytes),
                parsed: null
            };
        }
    }

    return clValue?.toString ? clValue.toString() : null;
};

const executableDeployItemToJson = (item: ExecutableDeployItem | any): any => {
    if (item.moduleBytes) {
        const argsMap = new Map();
        // SDK v5 Args.args is a Map
        item.moduleBytes.args.args.forEach((val: any, key: any) => {
            argsMap.set(key, toLegacyCLValueJson(val));
        });
        return {
            ModuleBytes: {
                module_bytes: toHex(item.moduleBytes.moduleBytes),
                args: Array.from(argsMap.entries())
            }
        };
    }
    if (item.storedContractByHash) {
        const argsMap = new Map();
        item.storedContractByHash.args.args.forEach((val: any, key: any) => {
            argsMap.set(key, toLegacyCLValueJson(val));
        });
        return {
            StoredContractByHash: {
                hash: toHex(item.storedContractByHash.hash),
                entry_point: item.storedContractByHash.entryPoint,
                args: Array.from(argsMap.entries())
            }
        };
    }
    if (item.storedVersionedContractByHash) {
        const argsMap = new Map();
        item.storedVersionedContractByHash.args.args.forEach((val: any, key: any) => {
            argsMap.set(key, toLegacyCLValueJson(val));
        });
        // ContractHash in SDK v5: try .hash, .data, then the object itself
        const contractHash = item.storedVersionedContractByHash.hash;
        let hashHex = toHex(contractHash?.hash || contractHash?.data || contractHash);
        hashHex = hashHex.replace(/^hash-/, '');
        return {
            StoredVersionedContractByHash: {
                hash: hashHex,
                version: item.storedVersionedContractByHash.version,
                entry_point: item.storedVersionedContractByHash.entryPoint,
                args: Array.from(argsMap.entries())
            }
        };
    }
    // Handle Transfer if needed, usually ModuleBytes for us
    return {};
};

const argsToJson = (args: Args): any[] => {
    const result: any[] = [];
    const internalMap = (args as any).args;

    if (internalMap && typeof internalMap.entries === 'function') {
        try {
            const entries = Array.from(internalMap.entries()) as [any, any][];
            for (const entry of entries) {
                const key = entry[0];
                const value = entry[1];

                let json = toLegacyCLValueJson(value);

                if (json === undefined || json === null) {
                    json = value?.toString ? value.toString() : String(value);
                }

                result.push([key, json]);
            }
        } catch (e) {
            console.error("argsToJson: Error iterating args map", e);
        }
    } else {
        console.warn("[argsToJson] Args map is not iterable:", args);
    }
    return result;
};

const explorerCall = async (path: string) => {
    const response = await fetch(`/api/proxy?useExplorer=true&path=${encodeURIComponent(path)}`, {
        method: 'GET'
    });
    if (!response.ok) throw new Error(`Explorer API failed: ${response.status}`);
    return await response.json();
};

// Helper to get the main purse of the contract
const getMainPurse = async (contractHash: string): Promise<string> => {
    // Default fallback
    let mainPurse = 'uref-a4a21274a56589f679b7a86c69c74081e31249a002c7891651bbe42e2685a4cf-007';

    try {
        const stateRootRes = await rpcCall('chain_get_state_root_hash', []);
        const stateRootHash = stateRootRes.state_root_hash;
        const formattedHash = contractHash.startsWith('hash-') ? contractHash : `hash-${contractHash}`;
        const contractData = await rpcCall('state_get_item', {
            state_root_hash: stateRootHash,
            key: formattedHash,
            path: []
        });

        let namedKeys: any[] = [];
        if (contractData.stored_value?.Contract) {
            namedKeys = contractData.stored_value.Contract.named_keys;
        } else if (contractData.stored_value?.ContractPackage) {
            const newest = contractData.stored_value.ContractPackage.versions.slice(-1)[0].contract_hash;
            const realContractData = await rpcCall('state_get_item', {
                state_root_hash: stateRootHash,
                key: newest,
                path: []
            });
            namedKeys = realContractData.stored_value.Contract.named_keys;
        }
        const foundPurse = namedKeys.find((k: any) => k.name === '__contract_main_purse')?.key;
        if (foundPurse) mainPurse = foundPurse;
    } catch (e) {
        console.warn('[Casper] Metadata fetch failed, using purse fallback.');
    }
    return mainPurse;
};

/**
 * Fetch all protocol activity (deposits and withdrawals)
 */
/**
 * Fetch all protocol activity (deposits and withdrawals)
 * OPTIMIZATION: Only fetch activity newer than minTimestamp
 */
export const fetchProtocolActivity = async (contractHash: string, minTimestamp: number = 0) => {
    const commitments: string[] = [];
    const withdrawalsByHash = new Map<string, any>();

    // Track the latest timestamp we see in this batch to return it
    let maxSeenTimestamp = minTimestamp;

    try {
        const mainPurse = await getMainPurse(contractHash);

        let allTransfers: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 50) { // Increased cap since we break early now
            const response = await explorerCall(`/purse-urefs/${mainPurse}/transfers?page_size=100&page=${page}`);
            const data = response.data || [];

            if (data.length === 0) break;

            // Filter data and check for stop condition
            const newTransfers = [];
            for (const t of data) {
                const tDate = new Date(t.timestamp).getTime();
                if (tDate > minTimestamp) {
                    newTransfers.push(t);
                    if (tDate > maxSeenTimestamp) maxSeenTimestamp = tDate;
                } else {
                    // We reached old data!
                    hasMore = false;
                    // Don't break here because data might not be perfectly sorted within the page? 
                    // Usually it is. But safe to just filtering rest.
                }
            }

            allTransfers = [...allTransfers, ...newTransfers];

            // If we didn't add all items from this page, it means we hit the stop condition
            if (newTransfers.length < data.length) {
                hasMore = false;
            } else {
                // cspr.cloud may paginate at smaller chunks than the requested
                // limit. Keep paging until the response is empty rather than
                // assuming a 100-item page is always full — otherwise the oldest
                // deposit silently drops out and the Merkle root never matches.
                hasMore = data.length > 0;
            }

            page++;
        }

        // SORT by Block Height to match on-chain Merkle Tree execution order.
        // Timestamp sorting is unreliable (drift, same-block collisions).
        allTransfers.sort((a, b) => {
            if (a.block_height !== b.block_height) {
                return a.block_height - b.block_height;
            }
            // Same block? Use transfer_index if available (or assume API order reversed?)
            // Usually API returns descending. Check specific IDs/indices if needed.
            // For now, block_height is the primary correctness factor.
            return 0;
        });

        const uniqueHashes = Array.from(new Set(allTransfers.map((t: any) => t.deploy_hash))) as string[];

        for (const hash of uniqueHashes) {
            // Throttle to avoid upstream API rate limits through proxy.
            await new Promise(resolve => setTimeout(resolve, 200));

            try {
                const deploy = await explorerCall(`/deploys/${hash}`);
                const data = deploy.data;
                const success = data?.status === 'processed' && !data?.error_message;
                if (!success) continue;

                const args = data?.args || data?.session?.args || data?.session?.StoredContractByHash?.args;

                if (args) {
                    // Identify Deposit (single)
                    const commitmentValue = args.commitment?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'commitment' || a[0] === 'commitment')?.parsed : null);

                    if (commitmentValue) {
                        commitments.push(commitmentValue.toString());
                        continue;
                    }

                    // Identify Deposit (batch — `commitments` plural carries N leaves)
                    const batchCommitments = args.commitments?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'commitments' || a[0] === 'commitments')?.parsed : null);
                    if (Array.isArray(batchCommitments)) {
                        for (const c of batchCommitments) {
                            if (c !== undefined && c !== null) commitments.push(c.toString());
                        }
                        continue;
                    }

                    // Identify Withdrawal (if no commitment, check nullifier_hash or entry_point)
                    const nullifierValue = args.nullifier_hash?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'nullifier_hash' || a[0] === 'nullifier_hash')?.parsed : null);

                    if (nullifierValue || data?.entry_point === 'withdraw' || data?.session?.StoredVersionedContractByHash?.entry_point === 'withdraw') {
                        withdrawalsByHash.set(hash, {
                            hash: hash,
                            timestamp: data.timestamp,
                            nullifier: nullifierValue?.toString() || 'unknown',
                            recipient: args.recipient?.parsed || 'unknown'
                        });
                    }
                }
            } catch (e) {
                console.warn(`[Casper] Failed to fetch activity for deploy ${hash}:`, e);
            }
        }
    } catch (e: any) {
        console.warn('[Casper] Explorer activity sync failed:', e.message);
    }

    return {
        deposits: commitments,
        withdrawals: Array.from(withdrawalsByHash.values()).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        maxTimestamp: maxSeenTimestamp
    };
};

/**
 * Fetch strictly the most recent limited activity (deposits and withdrawals) as a single unified list.
 * OPTIMIZATION: Only fetches the first page to save bandwidth for the statistics page.
 * STREAMING: Calls onTransactionFound as soon as a transaction is parsed.
 */
export const fetchRecentActivity = async (
    contractHash: string,
    limit: number = 40,
    onTransactionFound?: (tx: any) => void
) => {
    const unifiedActivity: any[] = [];

    try {
        const mainPurse = await getMainPurse(contractHash);

        // ONLY fetch the first page 
        const response = await explorerCall(`/purse-urefs/${mainPurse}/transfers?page_size=${limit * 2}&page=1`);
        const data = response.data || [];

        const uniqueHashes = Array.from(new Set(data.map((t: any) => t.deploy_hash))) as string[];

        // Only process up to what we strictly need
        for (const hash of uniqueHashes.slice(0, limit * 2)) {
            try {
                const deploy = await explorerCall(`/deploys/${hash}`);
                const deployData = deploy.data;
                const success = deployData?.status === 'processed' && !deployData?.error_message;
                if (!success) continue;

                const args = deployData?.args || deployData?.session?.args || deployData?.session?.StoredContractByHash?.args;

                if (args) {
                    const commitmentValue = args.commitment?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'commitment' || a[0] === 'commitment')?.parsed : null);

                    if (commitmentValue && unifiedActivity.length < limit) {
                        const newTx = {
                            type: 'deposit',
                            hash: hash,
                            timestamp: deployData.timestamp,
                            commitment: commitmentValue.toString()
                        };
                        unifiedActivity.push(newTx);
                        if (onTransactionFound) onTransactionFound(newTx);
                        continue;
                    }

                    const nullifierValue = args.nullifier_hash?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'nullifier_hash' || a[0] === 'nullifier_hash')?.parsed : null);

                    if ((nullifierValue || deployData?.entry_point === 'withdraw' || deployData?.session?.StoredVersionedContractByHash?.entry_point === 'withdraw') && unifiedActivity.length < limit) {
                        const newTx = {
                            type: 'withdrawal',
                            hash: hash,
                            timestamp: deployData.timestamp,
                            nullifier: nullifierValue?.toString() || 'unknown',
                            recipient: args.recipient?.parsed || 'unknown'
                        };
                        unifiedActivity.push(newTx);
                        if (onTransactionFound) onTransactionFound(newTx);
                    }
                }
            } catch (e) {
                console.warn(`[Casper] Failed to fetch recent activity for deploy ${hash}:`, e);
            }
        }
    } catch (e: any) {
        console.warn('[Casper] Explorer recent activity sync failed:', e.message);
    }

    // Sort the unified list chronologically (newest first)
    return unifiedActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
};

/**
 * Quick stats function - just counts total transfers without fetching deploy details.
 * Much faster than fetchProtocolActivity for displaying hero stats.
 */
export const fetchQuickStats = async (contractHash: string): Promise<{ totalTransactions: number, deposits: number, withdrawals: number }> => {
    try {
        const mainPurse = await getMainPurse(contractHash);
        let totalCount = 0;
        let depositCount = 0;
        let withdrawalCount = 0;
        let page = 1;
        let hasMore = true;

        // Since we are checking args now to split the counts, we might need a small tradeoff on speed, 
        // but since they just want a fast count, we can do a rough estimate if transfer amount == deposit amount.
        // Actually, let's just use the raw transfer count for now and split it roughly by sender vs recipient,
        // or we simply fetch the deploys for a true accurate split if they only have ~200 txs.
        // To maintain the `fetchQuickStats` instantaneous speed, we will accurately count transfers 
        // by looking at the from_purse and to_purse on the transfer object itself.
        while (hasMore && page <= 10) {
            const response = await explorerCall(`/purse-urefs/${mainPurse}/transfers?page_size=100&page=${page}`);
            const data = response.data || [];

            for (const t of data) {
                // If the main purse is the to_purse, it received funds -> Deposit
                if (t.to_purse === mainPurse) {
                    depositCount++;
                }
                // If the main purse is the from_purse, it sent funds -> Withdrawal
                else if (t.from_purse === mainPurse) {
                    withdrawalCount++;
                }
            }
            totalCount += data.length;
            // Page until empty — see fetchProtocolActivityOptimized for context.
            hasMore = data.length > 0;
            page++;
        }

        return {
            totalTransactions: totalCount,
            deposits: depositCount,
            withdrawals: withdrawalCount
        };
    } catch (e) {
        console.warn('[Casper] Quick stats failed:', e);
        return { totalTransactions: 0, deposits: 0, withdrawals: 0 };
    }
};

/** Progress callback type for optimized sync */
export type SyncProgressCallback = (progress: {
    phase: 'fetching_transfers' | 'fetching_deploys' | 'processing';
    current: number;
    total: number;
    message: string;
}) => void;

/**
 * Fetch all protocol activity (deposits and withdrawals) - OPTIMIZED VERSION
 * Uses parallel requests with rate limiting for significantly faster sync.
 *
 * @param contractHash - The contract hash to sync
 * @param minTimestamp - Only fetch activity newer than this timestamp
 * @param onProgress - Optional callback for progress updates
 * @param abortSignal - Optional AbortSignal to cancel the operation
 */
export const fetchProtocolActivityOptimized = async (
    contractHash: string,
    minTimestamp: number = 0,
    onProgress?: SyncProgressCallback,
    abortSignal?: AbortSignal
) => {
    const commitments: string[] = [];
    const withdrawalsByHash = new Map<string, any>();
    let maxSeenTimestamp = minTimestamp;

    // Create request queue with optimized settings
    const queue = new RequestQueue({
        concurrency: 5,
        minDelay: 100,
        maxRetries: 3,
        baseBackoffMs: 500,
        maxBackoffMs: 10000,
        circuitBreakerThreshold: 5,
        circuitResetMs: 30000
    });

    try {
        const mainPurse = await getMainPurse(contractHash);

        // Check abort before starting
        if (abortSignal?.aborted) {
            throw new Error('Sync aborted');
        }

        // Phase 1: Fetch transfers
        onProgress?.({
            phase: 'fetching_transfers',
            current: 0,
            total: 0,
            message: 'Fetching transfer records...'
        });

        let allTransfers: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 50) {
            if (abortSignal?.aborted) {
                throw new Error('Sync aborted');
            }

            const response = await explorerCall(`/purse-urefs/${mainPurse}/transfers?page_size=100&page=${page}`);
            const data = response.data || [];

            if (data.length === 0) break;

            const newTransfers = [];
            for (const t of data) {
                const tDate = new Date(t.timestamp).getTime();
                if (tDate > minTimestamp) {
                    newTransfers.push(t);
                    if (tDate > maxSeenTimestamp) maxSeenTimestamp = tDate;
                } else {
                    hasMore = false;
                }
            }

            allTransfers = [...allTransfers, ...newTransfers];

            onProgress?.({
                phase: 'fetching_transfers',
                current: allTransfers.length,
                total: 0, // Unknown total
                message: `Found ${allTransfers.length} transfers...`
            });

            if (newTransfers.length < data.length) {
                // Hit an older-than-minTimestamp transfer; no need to fetch older pages
                hasMore = false;
            } else {
                // Otherwise keep paging until we get an empty response. cspr.cloud
                // sometimes paginates at smaller chunks than the requested limit,
                // so `data.length === 100` was a wrong stop condition that silently
                // dropped the oldest deposits (and broke Merkle root reconstruction).
                hasMore = data.length > 0;
            }

            page++;
        }

        // Sort by block height for deterministic Merkle tree order
        allTransfers.sort((a, b) => {
            if (a.block_height !== b.block_height) {
                return a.block_height - b.block_height;
            }
            return 0;
        });

        const uniqueHashes = Array.from(new Set(allTransfers.map((t: any) => t.deploy_hash))) as string[];

        if (uniqueHashes.length === 0) {
            return {
                deposits: commitments,
                withdrawals: [],
                maxTimestamp: maxSeenTimestamp
            };
        }


        // Phase 2: Fetch deploys in parallel
        onProgress?.({
            phase: 'fetching_deploys',
            current: 0,
            total: uniqueHashes.length,
            message: `Processing 0/${uniqueHashes.length} deploys...`
        });

        // Create sorted map to preserve block height order
        const hashToBlockHeight = new Map<string, number>();
        for (const t of allTransfers) {
            if (!hashToBlockHeight.has(t.deploy_hash)) {
                hashToBlockHeight.set(t.deploy_hash, t.block_height);
            }
        }

        // Create tasks for parallel execution
        const tasks: QueueTask<{ hash: string; deploy: any }>[] = uniqueHashes.map(hash => ({
            id: hash,
            execute: async (signal?: AbortSignal) => {
                if (signal?.aborted) throw new Error('Aborted');
                const deploy = await explorerCall(`/deploys/${hash}`);
                return { hash, deploy };
            }
        }));

        // Process all deploys in parallel
        const results = await queue.processAll(
            tasks,
            (progress: QueueProgress) => {
                onProgress?.({
                    phase: 'fetching_deploys',
                    current: progress.completed,
                    total: progress.total,
                    message: `Processing ${progress.completed}/${progress.total} deploys...`
                });
            },
            abortSignal
        );

        // Phase 3: Process results (maintain block height order)
        onProgress?.({
            phase: 'processing',
            current: 0,
            total: results.length,
            message: 'Building commitment list...'
        });

        // Sort results by block height to maintain deterministic order
        const sortedResults = results
            .filter(r => r.success && r.data)
            .sort((a, b) => {
                const heightA = hashToBlockHeight.get(a.id) ?? 0;
                const heightB = hashToBlockHeight.get(b.id) ?? 0;
                return heightA - heightB;
            });

        let processedCount = 0;
        for (const result of sortedResults) {
            const { hash, deploy } = result.data!;
            const data = deploy.data;
            const success = data?.status === 'processed' && !data?.error_message;

            if (!success) continue;

            const args = data?.args || data?.session?.args || data?.session?.StoredContractByHash?.args;

            if (args) {
                // Identify Deposit (single)
                const commitmentValue = args.commitment?.parsed ||
                    (Array.isArray(args) ? args.find((a: any) => a.name === 'commitment' || a[0] === 'commitment')?.parsed : null);

                // Identify Deposit (batch — `commitments` plural)
                const batchCommitments = args.commitments?.parsed ||
                    (Array.isArray(args) ? args.find((a: any) => a.name === 'commitments' || a[0] === 'commitments')?.parsed : null);

                if (commitmentValue) {
                    // IMPORTANT: Handle potential precision loss for large numbers
                    // Explorer API may return parsed as a number, which loses precision for U256
                    let commitmentStr: string;
                    if (typeof commitmentValue === 'number') {
                        console.warn(`[Casper] WARNING - commitment is a number, may have precision loss!`);
                        console.warn(`[Casper] Raw number value: ${commitmentValue}`);
                        // Try to get bytes representation instead if available
                        const bytesHex = args.commitment?.bytes;
                        if (bytesHex) {
                            // Convert little-endian hex bytes to BigInt
                            const cleanHex = bytesHex.replace(/^0x/, '');
                            // Casper U256 is little-endian, need to reverse bytes
                            const bytes = cleanHex.match(/.{2}/g) || [];
                            const bigEndianHex = bytes.reverse().join('');
                            commitmentStr = BigInt('0x' + bigEndianHex).toString();
                        } else {
                            commitmentStr = commitmentValue.toString();
                        }
                    } else {
                        commitmentStr = commitmentValue.toString();
                    }
                    commitments.push(commitmentStr);
                } else if (Array.isArray(batchCommitments)) {
                    // batch deposit — push every leaf, in the original order
                    for (const c of batchCommitments) {
                        if (c === undefined || c === null) continue;
                        commitments.push(c.toString());
                    }
                } else {
                    // Identify Withdrawal
                    const nullifierValue = args.nullifier_hash?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'nullifier_hash' || a[0] === 'nullifier_hash')?.parsed : null);

                    if (nullifierValue || data?.entry_point === 'withdraw' || data?.session?.StoredVersionedContractByHash?.entry_point === 'withdraw' || data?.entry_point === 'withdraw_batch') {
                        withdrawalsByHash.set(hash, {
                            hash: hash,
                            timestamp: data.timestamp,
                            nullifier: nullifierValue?.toString() || 'unknown',
                            recipient: args.recipient?.parsed || 'unknown'
                        });
                    }
                }
            }

            processedCount++;
            if (processedCount % 10 === 0) {
                onProgress?.({
                    phase: 'processing',
                    current: processedCount,
                    total: sortedResults.length,
                    message: `Processed ${processedCount}/${sortedResults.length} deploys`
                });
            }
        }

        // Log failed requests
        const failedCount = results.filter(r => !r.success).length;
        if (failedCount > 0) {
            console.warn(`[Casper] ${failedCount} deploy fetches failed (will be retried on next sync)`);
        }

    } catch (e: any) {
        if (e.message === 'Sync aborted') {
            throw e;
        }
        console.warn('[Casper] Optimized sync failed:', e.message);
        throw e;
    }

    return {
        deposits: commitments,
        withdrawals: Array.from(withdrawalsByHash.values()).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        maxTimestamp: maxSeenTimestamp
    };
};

/**
 * Legacy wrapper for Merkle Tree sync (deposits only)
 */
export const fetchContractEvents = async (contractHash: string): Promise<string[]> => {
    const activity = await fetchProtocolActivity(contractHash);
    return activity.deposits;
};

const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
export const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || '0585ceff379fa73cf371b0ec868a866b11f3301e5a2eceee3085763b0e7c1400';

// Get contract hash without 'hash-' prefix
export const getContractHash = (): string => {
    return CONTRACT_HASH.startsWith('hash-') ? CONTRACT_HASH.slice(5) : CONTRACT_HASH;
};

// Helper: Get Account Hash hex from Public Key hex
export const getAccountHash = (publicKeyHex: string): string => {
    const pk = PublicKey.fromHex(publicKeyHex);
    return pk.accountHash().toHex();
};

// Create a deposit transaction using session WASM (required for CSPR transfer)
export const createDepositSessionTransaction = (
    activeKey: string,
    commitment: bigint,
    amount: bigint,
    wasmBytes: Uint8Array
): Deploy => {
    const senderKey = PublicKey.fromHex(activeKey);
    const contractHashBytes = Uint8Array.from(Buffer.from(getContractHash(), 'hex'));

    const args = Args.fromMap({
        contract_package_hash: CLValue.newCLByteArray(contractHashBytes),
        commitment: CLValue.newCLUInt256(commitment.toString()),
        amount: CLValue.newCLUInt512(amount.toString())
    });

    const paymentAmount = DEFAULT_DEPOSIT_PAYMENT_MOTES.toString();

    const deployParams = new DeployHeader();
    deployParams.account = senderKey;
    deployParams.chainName = NETWORK_NAME;
    deployParams.gasPrice = 1;
    deployParams.timestamp = new Timestamp(new Date());
    deployParams.ttl = new Duration(1800000); // 30 min

    const session = new ExecutableDeployItem();
    session.moduleBytes = new ModuleBytes(
        wasmBytes,
        args
    );

    const payment = ExecutableDeployItem.standardPayment(paymentAmount);

    return Deploy.makeDeploy(deployParams, payment, session);
};

/**
 * @deprecated Use createDepositSessionTransaction instead
 */
export const createDepositTransaction = (
    activeKey: string,
    commitment: bigint,
    amount: bigint
): Deploy => {
    return createDepositSessionTransaction(activeKey, commitment, amount, new Uint8Array(0));
};

/**
 * Create a withdraw transaction using SDK v5 ContractCallBuilder.
 *
 * `relayer` and `fee` are part of the ZK proof's public inputs (anti-tampering).
 * Pass `relayer = recipient` and `fee = 0n` for self-withdrawal — keeps the
 * verifier happy without paying a third-party relayer. Protocol fee (25 bps)
 * is deducted on-chain automatically and routed to the treasury.
 */
export const createWithdrawTransaction = (
    activeKey: string,
    proof: Uint8Array,
    root: bigint,
    nullifierHash: bigint,
    recipient: string,
    relayer: string,
    fee: bigint
): Deploy => {
    const senderKey = PublicKey.fromHex(activeKey);
    const recipientKey = PublicKey.fromHex(recipient);
    const relayerKey = PublicKey.fromHex(relayer);

    // Create List<U8> for proof
    const proofList = Array.from(proof).map(b => CLValue.newCLUint8(b));

    const args = Args.fromMap({
        proof: CLValue.newCLList(CLTypeUInt8, proofList),
        root: CLValue.newCLUInt256(root.toString()),
        nullifier_hash: CLValue.newCLUInt256(nullifierHash.toString()),
        recipient: CLValue.newCLKey(Key.createByType(recipientKey.accountHash().toHex(), KeyTypeID.Account)),
        relayer: CLValue.newCLKey(Key.createByType(relayerKey.accountHash().toHex(), KeyTypeID.Account)),
        fee: CLValue.newCLUInt512(fee.toString()),
    });

    const deployParams = new DeployHeader();
    deployParams.account = senderKey;
    deployParams.chainName = NETWORK_NAME;
    deployParams.gasPrice = 1;
    deployParams.timestamp = new Timestamp(new Date());
    deployParams.ttl = new Duration(1800000);

    const session = new ExecutableDeployItem();
    session.storedVersionedContractByHash = new StoredVersionedContractByHash(
        ContractHash.newContract(getContractHash()),
        'withdraw', // entry_point
        args,
        undefined // version
    );

    const payment = ExecutableDeployItem.standardPayment(DEFAULT_WITHDRAW_PAYMENT_MOTES.toString());

    return Deploy.makeDeploy(deployParams, payment, session);
};

// Helper: Serialize Deploy to Legacy JSON format
export const deployToLegacyJson = (deploy: Deploy): any => {
    const header = deploy.header;
    return {
        hash: toHex(deploy.hash),
        header: {
            account: header.account ? header.account.toHex() : '',
            timestamp: (header.timestamp as any).date ? (header.timestamp as any).date.toISOString() : new Date().toISOString(),
            ttl: (header.ttl as any).duration ? (header.ttl as any).duration + 'ms' : String(header.ttl),
            gas_price: header.gasPrice,
            body_hash: toHex(header.bodyHash),
            dependencies: header.dependencies.map((d: any) => toHex(d)),
            chain_name: header.chainName
        },
        payment: executableDeployItemToJson(deploy.payment),
        session: executableDeployItemToJson(deploy.session),
        approvals: deploy.approvals.map(a => ({
            signer: a.signer,
            signature: a.signature
        }))
    };
};

export const sendSignedTransaction = async (signedTransaction: Transaction | Deploy): Promise<string> => {
    if (signedTransaction instanceof Transaction) {
        const txJson = signedTransaction.toJSON();
        const result = await rpcCall('account_put_transaction', { transaction: txJson });
        return result.transaction_hash?.toString() || result.transactionHash?.toString();
    } else {
        const deployJson = deployToLegacyJson(signedTransaction);

        if (deployJson.session?.StoredVersionedContractByHash &&
            deployJson.session.StoredVersionedContractByHash.version === undefined) {
            deployJson.session.StoredVersionedContractByHash.version = null;
        }

        console.log('[sendSignedTransaction] deploy JSON:', JSON.stringify({ deploy: deployJson }, null, 2));

        const result = await rpcCall('account_put_deploy', { deploy: deployJson });
        return result.deploy_hash || result.deployHash;
    }
};

/**
 * Get the CSPR balance of a public key
 */
export const getBalance = async (publicKeyHex: string): Promise<string> => {
    try {
        const stateRootResult = await rpcCall('chain_get_state_root_hash', []);
        const stateRootHash = stateRootResult.state_root_hash;
        if (!stateRootHash) return "0";

        const accountInfoResult = await rpcCall('state_get_account_info', {
            public_key: publicKeyHex
        });
        const mainPurse = accountInfoResult.account?.main_purse;
        if (!mainPurse) return "0";

        const balanceResult = await rpcCall('state_get_balance', {
            state_root_hash: stateRootHash,
            purse_uref: mainPurse
        });

        const balanceValue = balanceResult.balance_value;
        if (balanceValue) {
            const cspr = parseInt(balanceValue) / 1_000_000_000;
            return cspr.toFixed(2);
        }
        return "0";
    } catch (e) {
        console.error("Failed to get balance:", e);
        return "0";
    }
};
