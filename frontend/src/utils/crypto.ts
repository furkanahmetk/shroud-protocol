import { buildMimc7 } from 'circomlibjs';

export class CryptoUtils {
    private mimc: any;

    constructor() {
    }

    async init() {
        this.mimc = await buildMimc7();
    }

    generateSecrets() {
        // In browser, use window.crypto
        const randomBytes = new Uint8Array(31);
        window.crypto.getRandomValues(randomBytes);
        const nullifier = BigInt('0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));

        window.crypto.getRandomValues(randomBytes);
        const secret = BigInt('0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));

        return { nullifier, secret };
    }

    computeCommitment(nullifier: bigint, secret: bigint): bigint {
        const res = this.mimc.multiHash([nullifier, secret]);
        return this.mimc.F.toObject(res);
    }

    computeNullifierHash(nullifier: bigint): bigint {
        const res = this.mimc.multiHash([nullifier]);
        return this.mimc.F.toObject(res);
    }
}
