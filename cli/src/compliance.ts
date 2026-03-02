import fs from 'fs';
import { resolve } from 'path';
import { CryptoUtils } from './crypto';

// Export the derived compliance details
export async function exportViewingKeyCommand(secretsPath: string, outputPath: string) {
    console.log(`[Compliance] Reading secrets from ${secretsPath}`);
    const resolvedPath = resolve(secretsPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Secret file not found: ${resolvedPath}`);
    }

    const unparsed = fs.readFileSync(resolvedPath, 'utf8');
    const secrets = JSON.parse(unparsed);

    if (!secrets.nullifier || !secrets.secret) {
        throw new Error('Secret file is missing `nullifier` or `secret` fields.');
    }

    console.log(`[Compliance] Generating Cryptographic Proofs from Secret & Nullifier`);

    // Crypto logic internally hashes the commitment and nullifierHash for Circom
    const crypto = new CryptoUtils();
    await crypto.init();

    const nullifierBigInt = BigInt(secrets.nullifier);
    const secretBigInt = BigInt(secrets.secret);

    const commitment = crypto.computeCommitment(nullifierBigInt, secretBigInt);
    const nullifierHash = crypto.computeNullifierHash(nullifierBigInt);

    const complianceData = {
        disclaimer: "KEEP THIS FILE EXTREMELY SAFE. Anyone possessing this file can claim the withdrawn funds if they have not already been submitted.",
        viewing_key: {
            nullifier: secrets.nullifier,
            secret: secrets.secret
        },
        public_verification: {
            commitment: commitment.toString(),
            nullifier_hash: nullifierHash.toString()
        }
    };

    const outStr = JSON.stringify(complianceData, null, 2);

    if (outputPath) {
        fs.writeFileSync(resolve(outputPath), outStr);
        console.log(`\n[Compliance] 🎉 Viewing key successfully exported to ${outputPath}\n`);
    } else {
        console.log(`\n[Compliance] Generated Viewing Key:\n`);
        console.log(outStr);
        console.log(`\n`);
    }
}
