/**
 * Casper SDK v5 utilities for Shroud Protocol
 * Uses Transaction API (v2) for Casper Wallet compatibility
 */
import {
    PublicKey,
    Args,
    CLValue,
    ContractCallBuilder,
    HttpHandler,
    RpcClient,
    Transaction,
    SessionBuilder,
    Deploy,
    DeployHeader,
    ExecutableDeployItem,
    Duration,
    ModuleBytes,
    StoredContractByHash,
    StoredVersionedContractByHash,
    ContractHash,
    Approval,
    Timestamp,
    Key,
    KeyTypeID,
    CLTypeUInt8,
} from 'casper-js-sdk';

const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || 'https://node.testnet.casper.network/rpc';
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
export const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || 'eab05369d5f955239217e3bf2d11d15b996bbb14c7138812591eb2347dfeba4b';

// Get contract hash without 'hash-' prefix
export const getContractHash = (): string => {
    return CONTRACT_HASH.startsWith('hash-') ? CONTRACT_HASH.slice(5) : CONTRACT_HASH;
};

/**
 * Create a deposit transaction using session WASM (required for CSPR transfer)
 */
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

    const paymentAmount = 150_000_000_000; // 150 CSPR - increased for complex WASM execution

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
    // Fallback - won't work for transfer, but keeps API compatible
    return createDepositSessionTransaction(activeKey, commitment, amount, new Uint8Array(0));
};

/**
 * Create a withdraw transaction using SDK v5 ContractCallBuilder
 * Uses Key type for recipient and List[U8] for proof (matching CLI)
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

    // Create Key from PublicKey's account hash using prefixed string format
    // This ensures proper serialization (Key.newKey properly populates the 'account' property)
    const recipientAccountKey = Key.newKey(recipientKey.accountHash().toPrefixedString());

    // Create List<U8> for proof (matches CLI: CLValueBuilder.list(Array.from(proof).map(b => CLValueBuilder.u8(b))))
    const proofList = Array.from(proof).map(b => CLValue.newCLUint8(b));

    const args = Args.fromMap({
        proof: CLValue.newCLList(CLTypeUInt8, proofList),
        root: CLValue.newCLUInt256(root.toString()),
        nullifier_hash: CLValue.newCLUInt256(nullifierHash.toString()),
        recipient: CLValue.newCLKey(recipientAccountKey),
    });

    const deployParams = new DeployHeader();
    deployParams.account = senderKey;
    deployParams.chainName = NETWORK_NAME;
    deployParams.gasPrice = 1;
    deployParams.timestamp = new Timestamp(new Date());
    deployParams.ttl = new Duration(1800000);

    const session = new ExecutableDeployItem();
    // StoredVersionedContractByHash(hash, entryPoint, args, version)
    // We must pass null explicitly so it appears in the JSON, otherwise wallet throws "arg not valid"
    session.storedVersionedContractByHash = new StoredVersionedContractByHash(
        ContractHash.newContract(getContractHash()),
        'withdraw',
        args,
        null as any // Force null to be serialized
    );

    const payment = ExecutableDeployItem.standardPayment('100000000000'); // 100 CSPR for complex ZK verification

    return Deploy.makeDeploy(deployParams, payment, session);
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

/**
 * Send a signed transaction to the network
 * Uses local proxy to avoid CORS issues
 */
export const sendSignedTransaction = async (signedTransaction: Transaction | Deploy): Promise<string> => {
    console.log('[sendSignedTransaction] Starting submission...');

    if (signedTransaction instanceof Transaction) {
        // For Transaction v2, use account_put_transaction 
        const txJson = signedTransaction.toJSON();
        const result = await rpcCall('account_put_transaction', { transaction: txJson });
        console.log('[sendSignedTransaction] Transaction result:', result);
        return result.transaction_hash?.toString() || result.transactionHash?.toString();
    } else {
        // For Legacy Deploy, use account_put_deploy
        const deployJson = Deploy.toJSON(signedTransaction) as any;
        console.log('[sendSignedTransaction] Submitting deploy via proxy:', deployJson?.hash);
        console.log('[sendSignedTransaction] Deploy Approvals:', JSON.stringify(deployJson?.approvals));

        const result = await rpcCall('account_put_deploy', { deploy: deployJson });
        console.log('[sendSignedTransaction] Deploy result:', result);
        return result.deploy_hash || result.deployHash;
    }
};

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

/**
 * Get the CSPR balance of a public key
 */
export const getBalance = async (publicKeyHex: string): Promise<string> => {
    try {
        // 1. Get State Root Hash
        const stateRootResult = await rpcCall('chain_get_state_root_hash', []);
        const stateRootHash = stateRootResult.state_root_hash;

        if (!stateRootHash) return "0";

        // 2. Get Account Info
        // state_get_account_info expects 'public_key' OR 'account_identifier'
        const accountInfoResult = await rpcCall('state_get_account_info', {
            public_key: publicKeyHex
        });

        const mainPurse = accountInfoResult.account?.main_purse;
        if (!mainPurse) return "0";

        // 3. Get Balance
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

// Helper: Convert CLValue to Legacy JSON format { cl_type, bytes, parsed }
// SDK v5 CLValues have: type.typeName, bytes() method, toString()
const toLegacyCLValueJson = (clValue: CLValue | any): any => {
    if (!clValue) return null;

    // Already in legacy format
    if (clValue?.cl_type && clValue?.bytes !== undefined) return clValue;

    // SDK v5: Get type name from type.typeName property
    const typeName = clValue?.type?.typeName;
    const typeID = clValue?.type?.typeID;

    // SDK v5 uses bytes() as a METHOD, not a property
    const getBytes = (): Uint8Array => {
        if (typeof clValue.bytes === 'function') {
            return clValue.bytes();
        }
        return new Uint8Array(0);
    };

    // Handle numeric types (U8, U32, U64, U128, U256, U512)
    if (typeName && ['U8', 'U32', 'U64', 'U128', 'U256', 'U512'].includes(typeName)) {
        const bytes = getBytes();
        return {
            cl_type: typeName,
            bytes: toHex(bytes),
            parsed: clValue.toString()
        };
    }

    // Handle ByteArray - SDK v5 uses type.size for array length
    if (clValue?.type?.size !== undefined) {
        const bytes = getBytes();
        const size = clValue.type.size;
        return {
            cl_type: { ByteArray: size },
            bytes: toHex(bytes),
            parsed: toHex(bytes)
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

    // Handle String type
    if (typeName === 'String') {
        const bytes = getBytes();
        return {
            cl_type: 'String',
            bytes: toHex(bytes),
            parsed: clValue.toString()
        };
    }

    // Handle Boolean
    if (typeName === 'Bool') {
        const bytes = getBytes();
        return {
            cl_type: 'Bool',
            bytes: toHex(bytes),
            parsed: clValue.toString() === 'true'
        };
    }

    // Fallback: try toJSON if available, otherwise return string representation
    if (typeof clValue.toJSON === 'function') {
        return clValue.toJSON();
    }

    // Last resort - try to extract bytes and infer type
    try {
        const bytes = getBytes();
        if (bytes.length > 0) {
            return {
                cl_type: typeName || 'Unknown',
                bytes: toHex(bytes),
                parsed: clValue.toString ? clValue.toString() : toHex(bytes)
            };
        }
    } catch (e) {
        console.warn('Failed to serialize CLValue:', e);
    }

    return clValue?.toString ? clValue.toString() : null;
};

const executableDeployItemToJson = (item: ExecutableDeployItem): any => {
    if (item.moduleBytes) {
        return {
            ModuleBytes: {
                module_bytes: toHex(item.moduleBytes.moduleBytes),
                args: argsToJson(item.moduleBytes.args)
            }
        };
    }
    if (item.storedContractByHash) {
        return {
            StoredContractByHash: {
                hash: toHex(item.storedContractByHash.hash),
                entry_point: item.storedContractByHash.entryPoint,
                args: argsToJson(item.storedContractByHash.args)
            }
        };
    }
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
                console.log(`[argsToJson] Key: ${key}, Value type: ${value?.type?.typeName || value?.constructor?.name}`);

                let json = toLegacyCLValueJson(value);

                // Ensure we never have undefined in the result
                if (json === undefined || json === null) {
                    console.warn(`[argsToJson] Warning: CLValue for key "${key}" serialized to null/undefined`);
                    // Try a more aggressive fallback
                    json = value?.toString ? value.toString() : String(value);
                }

                console.log(`[argsToJson] Serialized ${key}:`, JSON.stringify(json));
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

// Re-export for use in other modules
export { Transaction, PublicKey, Args, CLValue, Deploy, Approval };
