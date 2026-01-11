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
    TransactionV1,
} from 'casper-js-sdk';

const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || 'https://node.testnet.casper.network/rpc';
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || '5ebf4ad5f80e5b5613df0506d13d95225150487ac4434cf2c0ffba22d743fa14';

// Get contract hash without 'hash-' prefix
const getContractHash = (): string => {
    return CONTRACT_HASH.startsWith('hash-') ? CONTRACT_HASH.slice(5) : CONTRACT_HASH;
};

/**
 * Create a deposit transaction using SDK v5 ContractCallBuilder
 */
export const createDepositTransaction = (
    activeKey: string,
    commitment: bigint,
    amount: bigint
): TransactionV1 => {
    const senderKey = PublicKey.fromHex(activeKey);

    // Build args using CLValue factory methods
    const args = Args.fromMap({
        commitment: CLValue.newCLUInt256(commitment.toString()),
        amount: CLValue.newCLUInt512(amount.toString()),
    });

    // Build transaction using ContractCallBuilder
    const transaction = new ContractCallBuilder()
        .from(senderKey)
        .byHash(getContractHash())
        .entryPoint('deposit')
        .runtimeArgs(args)
        .payment(5_000_000_000) // 5 CSPR
        .chainName(NETWORK_NAME)
        .ttl(1800000) // 30 minutes
        .build();

    return transaction;
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
): TransactionV1 => {
    const senderKey = PublicKey.fromHex(activeKey);
    const recipientKey = PublicKey.fromHex(recipient);

    const args = Args.fromMap({
        proof: CLValue.newCLByteArray(proof),
        root: CLValue.newCLUInt256(root.toString()),
        nullifier_hash: CLValue.newCLUInt256(nullifierHash.toString()),
        recipient: CLValue.newCLKey(recipientKey),
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
export const sendSignedTransaction = async (signedTransaction: TransactionV1): Promise<string> => {
    const httpHandler = new HttpHandler(NODE_URL);
    const rpcClient = new RpcClient(httpHandler);

    const result = await rpcClient.putTransaction(signedTransaction);
    return result.transactionHash.toString();
};

// Re-export for use in other modules
export { TransactionV1, PublicKey, Args, CLValue };
