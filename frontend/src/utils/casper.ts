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
    ContractHash,
    Approval,
    Timestamp,
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

    const paymentAmount = 50_000_000_000; // 50 CSPR

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

    const args = Args.fromMap({
        proof: CLValue.newCLByteArray(proof),
        root: CLValue.newCLUInt256(root.toString()),
        nullifier_hash: CLValue.newCLUInt256(nullifierHash.toString()),
        recipient: CLValue.newCLPublicKey(recipientKey),
    });

    const deployParams = new DeployHeader();
    deployParams.account = senderKey;
    deployParams.chainName = NETWORK_NAME;
    deployParams.gasPrice = 1;
    deployParams.timestamp = new Timestamp(new Date());
    deployParams.ttl = new Duration(1800000);

    const session = new ExecutableDeployItem();
    session.storedContractByHash = new StoredContractByHash(
        ContractHash.newContract(getContractHash()),
        'withdraw',
        args
    );

    const payment = ExecutableDeployItem.standardPayment('10000000000'); // 10 CSPR as string

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
 */
export const sendSignedTransaction = async (signedTransaction: Transaction | Deploy): Promise<string> => {
    const httpHandler = new HttpHandler(NODE_URL);
    const rpcClient = new RpcClient(httpHandler);

    if (signedTransaction instanceof Transaction) {
        const result = await rpcClient.putTransaction(signedTransaction);
        return result.transactionHash.toString();
    } else {
        // Handle Legacy Deploy
        const result = await (rpcClient as any).deploy(signedTransaction);
        return result.deploy_hash;
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
const toLegacyCLValueJson = (clValue: CLValue | any): any => {
    if (clValue?.cl_type && clValue?.bytes !== undefined) return clValue;

    // Use clType().toString() if available to identify type reliably
    let typeName = clValue?.constructor?.name;
    if (clValue?.clType && typeof clValue.clType === 'function') {
        const typeObj = clValue.clType();
        if (typeObj && typeObj.toString) typeName = typeObj.toString();
        // SDK v5 clType() usually returns an object that has a tag or toString
        // e.g. U512 type object.
        // Let's rely on constructor name as primary but be careful about bundling.
        // Actually, most reliable is checking instance prototypes or tags.
        // Reverting to constructor name but handling variations.
        typeName = clValue?.constructor?.name;
    }

    if (['CLU8', 'CLU32', 'CLU64', 'CLU128', 'CLU256', 'CLU512'].includes(typeName)) {
        return {
            cl_type: typeName.replace('CL', 'U'),
            bytes: toHex(clValue.toBytes()),
            parsed: clValue.toString()
        };
    }

    // Also handle just "U512", "U256" if constructor name is simplified
    if (['U8', 'U32', 'U64', 'U128', 'U256', 'U512'].includes(typeName)) {
        return {
            cl_type: typeName,
            bytes: toHex(clValue.toBytes()),
            parsed: clValue.toString()
        };
    }

    if (typeName === 'CLByteArray' || typeName === 'ByteArray') {
        return {
            cl_type: { ByteArray: 32 },
            bytes: toHex(clValue.data),
            parsed: toHex(clValue.data)
        };
    }

    if (typeName === 'CLPublicKey' || typeName === 'PublicKey') {
        return {
            cl_type: 'PublicKey',
            bytes: clValue.toHex ? clValue.toHex() : toHex(clValue.data),
            parsed: clValue.toHex ? clValue.toHex() : toHex(clValue.data)
        };
    }

    return clValue?.toJSON ? clValue.toJSON() : clValue;
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
                let json = toLegacyCLValueJson(value);
                if (json === undefined) json = null;
                result.push([key, json]);
            }
        } catch (e) {
            console.error("DEBUG argsToJson: Error iterating", e);
        }
    }
    return result;
};

// Re-export for use in other modules
export { Transaction, PublicKey, Args, CLValue, Deploy, Approval };
