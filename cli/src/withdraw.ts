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

    // Load all commitments from local cache to rebuild the tree exactly as the contract has it
    const allCommitments = await crypto.loadCommitmentsFromCache(contractHash);
    console.log(`   Found ${allCommitments.length} commitments in local cache`);

    let pathElements: bigint[];
    let pathIndices: number[];
    let root: bigint;
    let actualIndex: number;

    // Check if our commitment is in the cache
    const ourIndex = allCommitments.findIndex(c => c === commitment);

    if (ourIndex !== -1 && allCommitments.length > 0) {
        // Rebuild tree with all real commitments from cache
        const tree = crypto.createMerkleTree();
        for (const c of allCommitments) {
            tree.insert(c);
        }

        const path = tree.getPath(ourIndex);
        pathElements = path.pathElements;
        pathIndices = path.pathIndices;
        root = tree.getRoot();
        actualIndex = ourIndex;
        console.log(`   ✅ Using cached commitments (index: ${actualIndex})`);
    } else {
        // Fallback: use stored leafIndex with placeholder zeros (works only for first deposit)
        console.log('   ⚠️ Commitment not found in cache, using stored leafIndex');
        const tree = crypto.createMerkleTree();
        for (let i = 0; i < leafIndex; i++) {
            tree.insert(0n);
        }
        tree.insert(commitment);

        const path = tree.getPath(leafIndex);
        pathElements = path.pathElements;
        pathIndices = path.pathIndices;
        root = tree.getRoot();
        actualIndex = leafIndex;
    }

    console.log(`   Leaf index: ${actualIndex}`);
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

