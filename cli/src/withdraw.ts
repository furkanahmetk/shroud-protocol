import { CryptoUtils } from './crypto';
import { BlockchainClient } from './blockchain';
const snarkjs = require('snarkjs');

export async function withdrawCommand(
    nodeUrl: string,
    contractHash: string,
    recipientAddress: string,
    secretsFile: string,
    circuitWasmPath: string,
    provingKeyPath: string,
    senderKeyPath: string
) {
    console.log('🔓 Loading secrets...');
    const crypto = new CryptoUtils();
    await crypto.init();
    const { nullifier, secret, commitment } = await crypto.loadSecrets(secretsFile);

    console.log('🌳 Reconstructing Merkle Tree...');
    // In a real implementation, we would query events from the blockchain to reconstruct the tree
    // For MVP, we assume a mock tree or just use the commitment as the root (simplified)
    // TODO: Implement event fetching and tree reconstruction
    const root = commitment; // Placeholder
    const pathElements = new Array(20).fill(0n); // Placeholder
    const pathIndices = new Array(20).fill(0); // Placeholder

    console.log('⚡ Generating Zero-Knowledge Proof...');
    const input = {
        nullifier: nullifier,
        secret: secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
        root: root,
        nullifierHash: crypto.computeNullifierHash(nullifier),
        recipient: BigInt(recipientAddress), // Assuming recipient is convertible to BigInt for circuit
        relayer: 0n,
        fee: 0n
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        circuitWasmPath,
        provingKeyPath
    );

    // Format proof for contract
    // This depends on how the contract expects the proof bytes
    // For MVP we just send dummy bytes if we can't easily serialize
    const proofBytes = new Uint8Array(Buffer.from(JSON.stringify(proof)));

    console.log('\n💸 Submitting withdrawal transaction...');
    const blockchain = new BlockchainClient(nodeUrl, contractHash);

    const deployHash = await blockchain.withdraw(
        proofBytes,
        root,
        crypto.computeNullifierHash(nullifier),
        recipientAddress,
        senderKeyPath
    );

    console.log(`\n✅ Withdrawal submitted!`);
    console.log(`Deploy hash: ${deployHash}`);
}
