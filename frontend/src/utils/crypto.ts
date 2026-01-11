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

    computeMerkleRoot(leaf: bigint, pathIndices: number[], pathElements: bigint[]): bigint {
        let current = leaf;
        for (let i = 0; i < pathIndices.length; i++) {
            const pathElement = pathElements[i];
            const pathIndex = pathIndices[i];

            // pathIndex: 0 means we are left, sibling is right?
            // Wait, standard convention:
            // If pathIndex = 0, sibling is on the right?
            // Let's check CLI implementation I wrote earlier.
            // CLI: if (pathIndex === 0) { hash(current, pathElement) } else { hash(pathElement, current) }
            // Wait, in CLI insert():
            // Even index (left): pathIndices.push(0); pathElements.push(sibling);
            // So if pathIndex is 0, we are on the LEFT. Sibling is RIGHT (pathElement).
            // Hash(current, pathElement). Correct.

            if (pathIndex === 0) {
                const res = this.mimc.multiHash([current, pathElement]);
                current = this.mimc.F.toObject(res);
            } else {
                const res = this.mimc.multiHash([pathElement, current]);
                current = this.mimc.F.toObject(res);
            }
        }
        return current;
    }
}
