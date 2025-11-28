import { randomBytes } from 'crypto';
const { buildMimc7 } = require('circomlibjs');
import * as fs from 'fs';

export class CryptoUtils {
    private mimc: any;

    constructor() {
    }

    async init() {
        this.mimc = await buildMimc7();
    }

    generateSecrets(): { nullifier: bigint; secret: bigint } {
        const nullifier = BigInt('0x' + randomBytes(31).toString('hex'));
        const secret = BigInt('0x' + randomBytes(31).toString('hex'));
        return { nullifier, secret };
    }

    computeCommitment(nullifier: bigint, secret: bigint): bigint {
        return this.mimc.multiHash([nullifier, secret]);
    }

    computeNullifierHash(nullifier: bigint): bigint {
        return this.mimc.hash(nullifier);
    }

    async saveSecrets(
        nullifier: bigint,
        secret: bigint,
        commitment: bigint,
        filepath: string
    ): Promise<void> {
        const data = {
            nullifier: nullifier.toString(),
            secret: secret.toString(),
            commitment: commitment.toString(),
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    }

    async loadSecrets(filepath: string): Promise<{
        nullifier: bigint;
        secret: bigint;
        commitment: bigint;
    }> {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

        return {
            nullifier: BigInt(data.nullifier),
            secret: BigInt(data.secret),
            commitment: BigInt(data.commitment),
        };
    }
}
