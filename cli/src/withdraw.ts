import { CryptoUtils } from './crypto';
import { BlockchainClient } from './blockchain';
import { snarkjsProofToBytes } from './proof_codec';
const snarkjs = require('snarkjs');

export async function withdrawCommand(
    nodeUrl: string,
    contractHash: string,
    recipientAddress: string,
    secretsFile: string,
    circuitWasmPath: string,
    provingKeyPath: string,
    senderKeyPath: string,
    relayerAddress?: string,
    feeMotes?: bigint
) {
    // Default: self-withdrawal (relayer = recipient, fee = 0).
    // Protocol fee (25 bps) is deducted on-chain regardless.
    const relayer = relayerAddress ?? recipientAddress;
    const fee = feeMotes ?? 0n;
    console.log('🔓 Loading secrets...');
    const crypto = new CryptoUtils();
    await crypto.init();
    const { nullifier, secret, commitment, leafIndex } = await crypto.loadSecrets(secretsFile);

    console.log('🌳 Reconstructing Merkle Tree...');
    const blockchain = new BlockchainClient(nodeUrl, contractHash);

    // 🔎 ON-CHAIN SYNC: Fetch commitments directly from blockchain to ensure matching root
    const allCommitments = await blockchain.getDeposits();

    let pathElements: bigint[];
    let pathIndices: number[];
    let root: bigint;
    let actualIndex: number;

    // Check if our commitment is in the fetched data
    const ourIndex = allCommitments.findIndex(c => c === commitment);

    if (allCommitments.length > 0) {
        console.log(`   📝 Found ${allCommitments.length} on-chain commitments`);
        console.log(`   📌 First 5: ${allCommitments.slice(0, 5).map(c => c.toString(16).substring(0, 8)).join(', ')}...`);
    }

    if (ourIndex !== -1) {
        // Rebuild tree with all real commitments from blockchain
        const tree = crypto.createMerkleTree();
        for (const c of allCommitments) {
            tree.insert(c);
        }

        const path = tree.getPath(ourIndex);
        pathElements = path.pathElements;
        pathIndices = path.pathIndices;
        root = path.root; // Use the root that matches this path
        actualIndex = ourIndex;
        console.log(`   ✅ Synced with blockchain (index: ${actualIndex})`);
        console.log(`   📊 Path root: ${root.toString(16).substring(0, 16)}...`);
        console.log(`   📊 Latest tree root: ${tree.getRoot().toString(16).substring(0, 16)}...`);
    } else {
        // Fallback for very new deposits that might not have indexed yet
        console.log('   ⚠️ Commitment not found on-chain, using cached leafIndex fallback');
        const tree = crypto.createMerkleTree();
        for (let i = 0; i < leafIndex; i++) {
            tree.insert(0n);
        }
        tree.insert(commitment);

        const path = tree.getPath(leafIndex);
        pathElements = path.pathElements;
        pathIndices = path.pathIndices;
        root = path.root; // Use path.root for consistency
        actualIndex = leafIndex;
    }

    console.log(`   Leaf index: ${actualIndex}`);
    console.log(`   Root: ${root.toString(16).substring(0, 16)}...`);

    // Deriving recipient + relayer numeric inputs for circuit (Account Hash)
    const addressToNumeric = (addr: string): bigint => {
        // casper-js-sdk v2 exposes the account hash via `toAccountHash()` (NOT
        // `accountHash()` — that name belongs to v5). Hitting the catch path
        // here silently substituted the raw public key, which caused the
        // generated proof's recipient/relayer to mismatch the contract's
        // address_to_fr value and every withdrawal reverted with InvalidProof.
        const { CLPublicKey } = require('casper-js-sdk');
        const pubKey = CLPublicKey.fromHex(addr);
        const hash: Uint8Array = pubKey.toAccountHash();
        return BigInt('0x' + Buffer.from(hash).toString('hex'));
    };
    const recipientNumeric = addressToNumeric(recipientAddress);
    const relayerNumeric = addressToNumeric(relayer);

    console.log('⚡ Generating Zero-Knowledge Proof...');
    const input = {
        nullifier: nullifier,
        secret: secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
        root: root,
        nullifierHash: crypto.computeNullifierHash(nullifier),
        recipient: recipientNumeric,
        relayer: relayerNumeric,
        fee: fee
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        circuitWasmPath,
        provingKeyPath
    );

    // Format proof for contract (compact 256-byte binary; see proof_codec.ts)
    const proofBytes = snarkjsProofToBytes(proof);

    console.log('\n💸 Submitting withdrawal transaction...');

    const deployHash = await blockchain.withdraw(
        proofBytes,
        root,
        crypto.computeNullifierHash(nullifier),
        recipientAddress,
        relayer,
        fee,
        senderKeyPath
    );

    console.log(`\n✅ Withdrawal submitted!`);
    console.log(`Deploy hash: ${deployHash}`);
}

