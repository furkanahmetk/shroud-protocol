import * as fs from 'fs';
import * as path from 'path';
import { CryptoUtils } from './crypto';
import { BlockchainClient } from './blockchain';
import { snarkjsProofToBytes } from './proof_codec';
const snarkjs = require('snarkjs');

export async function withdrawBatchCommand(
    nodeUrl: string,
    contractHash: string,
    secretsDir: string,
    recipientAddress: string,
    senderKeyPath: string,
    circuitWasmPath: string,
    provingKeyPath: string,
    relayerAddress?: string,
    feePerWithdrawalMotes?: bigint
) {
    if (!fs.existsSync(secretsDir)) {
        throw new Error(`secrets directory not found: ${secretsDir}`);
    }
    const secretFiles = fs.readdirSync(secretsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(secretsDir, f));

    if (secretFiles.length === 0) {
        throw new Error(`no .json secret files in ${secretsDir}`);
    }
    if (secretFiles.length > 10) {
        throw new Error(`batch limit is 10, found ${secretFiles.length} secret files`);
    }

    const relayer = relayerAddress ?? recipientAddress;
    const fee = feePerWithdrawalMotes ?? 0n;

    const crypto = new CryptoUtils();
    await crypto.init();
    const blockchain = new BlockchainClient(nodeUrl, contractHash);

    console.log(`🔓 Loading ${secretFiles.length} secret(s)…`);
    const allCommitments = await blockchain.getDeposits();
    console.log(`   📝 ${allCommitments.length} on-chain commitments fetched`);

    // Rebuild tree once and reuse for all withdrawals — saves N tree builds
    const tree = crypto.createMerkleTree();
    for (const c of allCommitments) {
        tree.insert(c);
    }

    const addressToNumeric = (addr: string): bigint => {
        // casper-js-sdk v2: use toAccountHash() (NOT accountHash() — that's v5).
        const { CLPublicKey } = require('casper-js-sdk');
        const hash: Uint8Array = CLPublicKey.fromHex(addr).toAccountHash();
        return BigInt('0x' + Buffer.from(hash).toString('hex'));
    };
    const recipientNumeric = addressToNumeric(recipientAddress);
    const relayerNumeric = addressToNumeric(relayer);

    const proofs: Uint8Array[] = [];
    const roots: bigint[] = [];
    const nullifierHashes: bigint[] = [];
    const recipients: string[] = [];
    const relayers: string[] = [];
    const fees: bigint[] = [];

    for (let i = 0; i < secretFiles.length; i++) {
        const file = secretFiles[i];
        console.log(`\n[${i + 1}/${secretFiles.length}] Processing ${path.basename(file)}…`);

        const { nullifier, secret, commitment } = await crypto.loadSecrets(file);
        const idx = allCommitments.findIndex(c => c === commitment);
        if (idx === -1) {
            throw new Error(`commitment ${commitment.toString(16)} not found on-chain — skip or re-sync`);
        }

        const pathData = tree.getPath(idx);
        const nullifierHash = crypto.computeNullifierHash(nullifier);

        console.log(`   leaf index ${idx}, root ${pathData.root.toString(16).slice(0, 16)}…`);
        console.log(`   generating proof…`);

        const input = {
            nullifier,
            secret,
            pathElements: pathData.pathElements,
            pathIndices: pathData.pathIndices,
            root: pathData.root,
            nullifierHash,
            recipient: recipientNumeric,
            relayer: relayerNumeric,
            fee,
        };
        const { proof } = await snarkjs.groth16.fullProve(input, circuitWasmPath, provingKeyPath);

        proofs.push(snarkjsProofToBytes(proof));
        roots.push(pathData.root);
        nullifierHashes.push(nullifierHash);
        recipients.push(recipientAddress);
        relayers.push(relayer);
        fees.push(fee);
    }

    console.log(`\n💸 Submitting batch withdrawal (${proofs.length} proofs in 1 tx)…`);
    const deployHash = await blockchain.withdrawBatch(
        proofs,
        roots,
        nullifierHashes,
        recipients,
        relayers,
        fees,
        senderKeyPath
    );

    console.log(`\n✅ Batch withdrawal submitted!`);
    console.log(`Deploy hash: ${deployHash}`);
}
