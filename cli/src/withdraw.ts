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
    const { nullifier, secret, commitment, leafIndex } = await crypto.loadSecrets(secretsFile);

    console.log('🌳 Reconstructing Merkle Tree...');
    // Create a Merkle tree and insert the commitment at the correct position
    // For a fresh contract with only our deposit, leafIndex should be 0
    const tree = crypto.createMerkleTree();

    // Insert dummy commitments up to leafIndex (for contracts with previous deposits)
    // Then insert our actual commitment
    // Note: For production, we'd fetch all commitments from on-chain events
    for (let i = 0; i < leafIndex; i++) {
        tree.insert(0n); // Placeholder for other deposits
    }
    tree.insert(commitment);

    // Get the path for our commitment
    const { pathElements, pathIndices } = tree.getPath(leafIndex);
    const root = tree.getRoot();

    console.log(`   Leaf index: ${leafIndex}`);
    console.log(`   Root: ${root.toString(16).substring(0, 16)}...`);

    console.log('⚡ Generating Zero-Knowledge Proof...');
    const input = {
        nullifier: nullifier,
        secret: secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
        root: root,
        nullifierHash: crypto.computeNullifierHash(nullifier),
        recipient: BigInt(recipientAddress.startsWith('0x') ? recipientAddress : '0x' + recipientAddress),
        relayer: 0n,
        fee: 0n
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        circuitWasmPath,
        provingKeyPath
    );

    // Format proof for contract
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
