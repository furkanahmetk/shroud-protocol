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
} from 'casper-js-sdk';

const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || 'https://node.testnet.casper.network/rpc';
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || 'eab05369d5f955239217e3bf2d11d15b996bbb14c7138812591eb2347dfeba4b';

// Get contract hash without 'hash-' prefix
const getContractHash = (): string => {
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
): Transaction => {
    const senderKey = PublicKey.fromHex(activeKey);
    const contractHashBytes = Uint8Array.from(Buffer.from(getContractHash(), 'hex'));

    // Arguments for valid_deposit session code
    const args = Args.fromMap({
        contract_package_hash: CLValue.newCLByteArray(contractHashBytes),
        commitment: CLValue.newCLUInt256(commitment.toString()),
        amount: CLValue.newCLUInt512(amount.toString())
    });

    // Create a transaction with session code using SessionBuilder
    const paymentAmount = 50_000_000_000; // 50 CSPR

    // We assume the network accepts standard Session Transactions
    let builder = new SessionBuilder()
        .from(senderKey)
        .chainName(NETWORK_NAME)
        .wasm(wasmBytes)
        .runtimeArgs(args)
        .payment(paymentAmount)
        .ttl(1800000); // 30 minutes

    // Build the transaction
    const transaction = builder.build();

    return transaction;
};

/**
 * @deprecated Use createDepositSessionTransaction instead
 */
export const createDepositTransaction = (
    activeKey: string,
    commitment: bigint,
    amount: bigint
): Transaction => {
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
): Transaction => {
    const senderKey = PublicKey.fromHex(activeKey);
    const recipientKey = PublicKey.fromHex(recipient);

    const args = Args.fromMap({
        proof: CLValue.newCLByteArray(proof),
        root: CLValue.newCLUInt256(root.toString()),
        nullifier_hash: CLValue.newCLUInt256(nullifierHash.toString()),
        recipient: CLValue.newCLPublicKey(recipientKey),
    });

    const transaction = new ContractCallBuilder()
        .from(senderKey)
        .byHash(getContractHash())
        .entryPoint('withdraw')
        .runtimeArgs(args)
        .payment(10_000_000_000) // 10 CSPR
        .chainName(NETWORK_NAME)
        .ttl(1800000)
        .build();

    return transaction;
};

/**
 * Send a signed transaction to the network
 */
export const sendSignedTransaction = async (signedTransaction: Transaction): Promise<string> => {
    const httpHandler = new HttpHandler(NODE_URL);
    const rpcClient = new RpcClient(httpHandler);

    const result = await rpcClient.putTransaction(signedTransaction);
    return result.transactionHash.toString();
};

// Re-export for use in other modules
export { Transaction, PublicKey, Args, CLValue };
