import { CryptoUtils } from './crypto';
import { BlockchainClient } from './blockchain';
import { DENOMINATION_LABEL, DENOMINATION_MOTES } from './config';

export async function depositCommand(
    nodeUrl: string,
    contractHash: string,
    senderKeyPath: string,
    outputFile: string,
    sessionWasmPath?: string
) {
    console.log('🔐 Generating secrets...');
    const crypto = new CryptoUtils();
    await crypto.init();
    const { nullifier, secret } = crypto.generateSecrets();
    const commitment = crypto.computeCommitment(nullifier, secret);

    console.log(`✅ Commitment: ${commitment.toString(16)}`);

    // Auto-detect leaf index from local cache
    const leafIndex = await crypto.saveCommitmentToCache(contractHash, commitment);

    console.log('\n📝 Saving secrets to file...');
    console.log(`   Leaf index: ${leafIndex} (auto-detected)`);
    await crypto.saveSecrets(nullifier, secret, commitment, outputFile, leafIndex);

    console.log('\n💸 Submitting deposit transaction...');
    if (sessionWasmPath) {
        console.log(`📦 Using session WASM for real CSPR transfer: ${sessionWasmPath}`);
    }
    const blockchain = new BlockchainClient(nodeUrl, contractHash);
    const amount = DENOMINATION_MOTES;

    const deployHash = await blockchain.deposit(
        commitment,
        amount,
        senderKeyPath,
        sessionWasmPath
    );

    console.log(`\n✅ ${DENOMINATION_LABEL} deposit submitted!`);
    console.log(`Deploy hash: ${deployHash}`);
    console.log(`\n⚠️  IMPORTANT: Keep ${outputFile} safe! You need it to withdraw.`);
}

