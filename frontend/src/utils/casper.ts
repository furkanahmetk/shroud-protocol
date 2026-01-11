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
} from 'casper-js-sdk';

const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || 'https://node.testnet.casper.network/rpc';
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
export const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || 'eab05369d5f955239217e3bf2d11d15b996bbb14c7138812591eb2347dfeba4b';

// Get contract hash without 'hash-' prefix
export const getContractHash = (): string => {
    return CONTRACT_HASH.startsWith('hash-') ? CONTRACT_HASH.slice(5) : CONTRACT_HASH;
};

/**
 * Create a deposit transaction using SDK v5 ContractCallBuilder
 */
// Re-export DeployUtil for internal use if needed
// SDK v5 imports
// The main import block at the top of the file is used for all SDK v5 imports.

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
    deployParams.ttl = new Duration(1800000); // 30 min

    const session = new ExecutableDeployItem();
    session.moduleBytes = new ModuleBytes(
        wasmBytes,
        args
    );

    // standardPayment returns an ExecutableDeployItem (ModuleBytes wrapped or similar)
    // Check if standardPayment returns ExecutableDeployItem or ModuleBytes
    // Snippet: var S = n.ExecutableDeployItem.standardPayment(c); return n.Deploy.makeDeploy(j, S, w)
    // So distinct is ExecutableDeployItem.
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
    deployParams.ttl = new Duration(1800000);

    const session = new ExecutableDeployItem();
    // StoredContractByHash expects ContractHash object
    // Assuming ContractHash constructor takes Uint8Array or we use static method
    // Previous snippet saw: n.ContractHash.newContract(i) -> likely static method?
    // Let's try to construct it.
    session.storedContractByHash = new StoredContractByHash(
        ContractHash.newContract(getContractHash()),
        'withdraw',
        args
    );

    const payment = ExecutableDeployItem.standardPayment('10000000000'); // 10 CSPR as string

    return Deploy.makeDeploy(deployParams, payment, session);
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
        // Use implicit cast to any if method missing on strict type
        const result = await (rpcClient as any).deploy(signedTransaction);
        return result.deploy_hash;
    }
};

// Re-export for use in other modules
export { Transaction, PublicKey, Args, CLValue, Deploy, Approval };
