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

    // Handle List
    if (typeName === 'List') {
        const listData = clValue.data || clValue.value() || [];
        const innerType = clValue.type.inner.typeName;
        return {
            cl_type: { List: innerType },
            bytes: toHex(getBytes()),
            parsed: listData.map((item: any) => toLegacyCLValueJson(item))
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

    // Fallback: try toJSON if available
    if (typeof clValue.toJSON === 'function') {
        const json = clValue.toJSON();
        if (json && json.cl_type) return json;
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
        return {
            StoredVersionedContractByHash: {
                hash: toHex(item.storedVersionedContractByHash.hash.data), // ContractHash has .data
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

                // Debug logging to help identify serialization issues
                // console.log(`[argsToJson] Key: ${key}, Value type: ${value?.type?.typeName || value?.constructor?.name}`);

                let json = toLegacyCLValueJson(value);

                // Ensure we never have undefined in the result
                if (json === undefined || json === null) {
                    // console.warn(`[argsToJson] Warning: CLValue for key "${key}" serialized to null/undefined`);
                    // Try a more aggressive fallback
                    json = value?.toString ? value.toString() : String(value);
                }

                // console.log(`[argsToJson] Serialized ${key}:`, JSON.stringify(json));
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
    let mainPurse = 'uref-3c4011cbd1c0d58793d9435fab15abb24faee31e3546d2e81c011cce6ed73047-007';

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
export const fetchProtocolActivity = async (contractHash: string) => {
    const commitments: string[] = [];
    const withdrawalsByHash = new Map<string, any>();

    try {
        const mainPurse = await getMainPurse(contractHash);
        console.log(`[Casper] Fetching transfers for purse: ${mainPurse}`);

        let allTransfers: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
            const response = await explorerCall(`/purses/${mainPurse}/transfers?page_size=100&page=${page}`);
            const data = response.data || [];
            allTransfers = [...allTransfers, ...data];
            hasMore = data.length === 100;
            page++;
        }

        allTransfers.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const uniqueHashes = Array.from(new Set(allTransfers.map((t: any) => t.deploy_hash))) as string[];
        console.log(`[Casper] Processing ${uniqueHashes.length} unique successful transfers...`);

        for (const hash of uniqueHashes) {
            try {
                const deploy = await explorerCall(`/deploys/${hash}`);
                const data = deploy.data;
                const success = data?.status === 'processed' && !data?.error_message;
                if (!success) continue;

                const args = data?.args || data?.session?.args || data?.session?.StoredContractByHash?.args;

                if (args) {
                    // Identify Deposit
                    const commitmentValue = args.commitment?.parsed ||
                        (Array.isArray(args) ? args.find((a: any) => a.name === 'commitment' || a[0] === 'commitment')?.parsed : null);

                    if (commitmentValue) {
                        commitments.push(commitmentValue.toString());
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
        withdrawals: Array.from(withdrawalsByHash.values()).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    };
};

/**
 * Legacy wrapper for Merkle Tree sync (deposits only)
 */
export const fetchContractEvents = async (contractHash: string): Promise<string[]> => {
    console.log('[Casper] Synchronizing commitments for Merkle Tree...');
    const activity = await fetchProtocolActivity(contractHash);
    return activity.deposits;
};

const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
export const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || 'eab05369d5f955239217e3bf2d11d15b996bbb14c7138812591eb2347dfeba4b';

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

    const paymentAmount = 150_000_000_000; // 150 CSPR

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

    const payment = ExecutableDeployItem.standardPayment(paymentAmount.toString());

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
 * Create a withdraw transaction using SDK v5 ContractCallBuilder
 */
export const createWithdrawTransaction = (
    activeKey: string,
    proof: Uint8Array,
    root: bigint,
    nullifierHash: bigint,
    recipient: string
): Deploy => {
    const senderKey = PublicKey.fromHex(activeKey);
    const recipientKey = PublicKey.fromHex(recipient);

    // Create List<U8> for proof
    const proofList = Array.from(proof).map(b => CLValue.newCLUint8(b));

    const args = Args.fromMap({
        proof: CLValue.newCLList(CLTypeUInt8, proofList),
        root: CLValue.newCLUInt256(root.toString()),
        nullifier_hash: CLValue.newCLUInt256(nullifierHash.toString()),
        recipient: CLValue.newCLKey(Key.createByType(recipientKey.accountHash().toHex(), KeyTypeID.Account)),
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

    const payment = ExecutableDeployItem.standardPayment('100000000000'); // 100 CSPR

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
    console.log('[sendSignedTransaction] Starting submission...');

    if (signedTransaction instanceof Transaction) {
        const txJson = signedTransaction.toJSON();
        const result = await rpcCall('account_put_transaction', { transaction: txJson });
        console.log('[sendSignedTransaction] Transaction result:', result);
        return result.transaction_hash?.toString() || result.transactionHash?.toString();
    } else {
        const deployJson = Deploy.toJSON(signedTransaction) as any;

        if (deployJson.session?.StoredVersionedContractByHash &&
            deployJson.session.StoredVersionedContractByHash.version === undefined) {
            deployJson.session.StoredVersionedContractByHash.version = null;
        }

        console.log('[sendSignedTransaction] Submitting deploy via proxy:', deployJson?.hash);
        const result = await rpcCall('account_put_deploy', { deploy: deployJson });
        console.log('[sendSignedTransaction] Deploy result:', result);
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



