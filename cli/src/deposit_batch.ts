import * as fs from 'fs';
import * as path from 'path';
import { CryptoUtils } from './crypto';
import { BlockchainClient } from './blockchain';
import { DENOMINATION_LABEL, DENOMINATION_MOTES } from './config';

export async function depositBatchCommand(
    nodeUrl: string,
    contractHash: string,
    senderKeyPath: string,
    outputDir: string,
    count: number,
    sessionWasmPath: string
) {
    if (count < 1 || count > 10) {
        throw new Error('count must be between 1 and 10 (MAX_BATCH_SIZE in contract)');
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`🔐 Generating ${count} secret(s)...`);
    const crypto = new CryptoUtils();
    await crypto.init();

    const commitments: bigint[] = [];
    const secretsPaths: string[] = [];

    for (let i = 0; i < count; i++) {
        const { nullifier, secret } = crypto.generateSecrets();
        const commitment = crypto.computeCommitment(nullifier, secret);
        commitments.push(commitment);

        // leafIndex is 'pending' because batch position depends on on-chain ordering;
        // withdraw flow resolves it dynamically from on-chain events.
        const leafIndex = await crypto.saveCommitmentToCache(contractHash, commitment);
        const secretsPath = path.join(outputDir, `shroud-secret-batch-${Date.now()}-${i}.json`);
        await crypto.saveSecrets(nullifier, secret, commitment, secretsPath, leafIndex);
        secretsPaths.push(secretsPath);

        console.log(`   [${i + 1}/${count}] commitment ${commitment.toString(16).slice(0, 16)}… → ${secretsPath}`);
    }

    const totalAmount = DENOMINATION_MOTES * BigInt(count);
    console.log(`\n💸 Submitting batch deposit (${count} × ${DENOMINATION_LABEL} = ${totalAmount} motes)…`);

    const blockchain = new BlockchainClient(nodeUrl, contractHash);
    const deployHash = await blockchain.depositBatch(
        commitments,
        totalAmount,
        senderKeyPath,
        sessionWasmPath
    );

    console.log(`\n✅ Batch deposit submitted in a single transaction!`);
    console.log(`Deploy hash: ${deployHash}`);
    console.log(`\n⚠️  IMPORTANT: Keep all ${count} secret files safe! You need each to withdraw.`);
    secretsPaths.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
}
