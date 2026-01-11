import { randomBytes } from 'crypto';
const { buildMimc7 } = require('circomlibjs');
import * as fs from 'fs';

const TREE_LEVELS = 20;

export class MerkleTree {
    private mimc: any;
    private levels: number;
    private filledSubtrees: bigint[];
    private nextIndex: number;
    private roots: bigint[];
    private pathCache: Map<number, { pathElements: bigint[]; pathIndices: number[] }>;

    constructor(mimc: any, levels: number = TREE_LEVELS) {
        this.mimc = mimc;
        this.levels = levels;
        this.nextIndex = 0;
        this.roots = [];
        this.pathCache = new Map();

        // Initialize filled_subtrees with zeros (matching contract)
        this.filledSubtrees = [];
        for (let i = 0; i < levels; i++) {
            this.filledSubtrees[i] = 0n;
        }
    }

    private hashPair(left: bigint, right: bigint): bigint {
        const res = this.mimc.multiHash([left, right]);
        return this.mimc.F.toObject(res);
    }

    insert(leaf: bigint): number {
        const leafIndex = this.nextIndex;
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];

        let currentIndex = this.nextIndex;
        let currentLevelHash = leaf;

        for (let i = 0; i < this.levels; i++) {
            let left: bigint;
            let right: bigint;

            if (currentIndex % 2 === 0) {
                // Even index: we're on the left, sibling is filled_subtrees[i]
                left = currentLevelHash;
                right = this.filledSubtrees[i];

                // Store path: sibling is on the right (pathIndex = 0 means we're left)
                pathIndices.push(0);
                pathElements.push(this.filledSubtrees[i]);

                // Update filled_subtrees
                this.filledSubtrees[i] = currentLevelHash;
            } else {
                // Odd index: we're on the right, sibling is filled_subtrees[i]
                left = this.filledSubtrees[i];
                right = currentLevelHash;

                // Store path: sibling is on the left (pathIndex = 1 means we're right)
                pathIndices.push(1);
                pathElements.push(this.filledSubtrees[i]);
            }

            currentLevelHash = this.hashPair(left, right);
            currentIndex = Math.floor(currentIndex / 2);
        }

        // Store the path for this leaf
        this.pathCache.set(leafIndex, { pathElements, pathIndices });

        // Store the root
        this.roots.push(currentLevelHash);
        if (this.roots.length > 30) {
            this.roots.shift();
        }

        this.nextIndex++;
        return leafIndex;
    }

    getRoot(): bigint {
        if (this.roots.length === 0) {
            return 0n;
        }
        return this.roots[this.roots.length - 1];
    }

    getPath(leafIndex: number): { pathElements: bigint[]; pathIndices: number[] } {
        const cached = this.pathCache.get(leafIndex);
        if (cached) {
            return cached;
        }
        // Fallback: return zeros (shouldn't happen if insert was called)
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];
        for (let i = 0; i < this.levels; i++) {
            pathElements.push(0n);
            pathIndices.push(0);
        }
        return { pathElements, pathIndices };
    }
}

export class CryptoUtils {
    private mimc: any;

    constructor() {
    }

    async init() {
        this.mimc = await buildMimc7();
    }

    createMerkleTree(): MerkleTree {
        return new MerkleTree(this.mimc, TREE_LEVELS);
    }

    generateSecrets(): { nullifier: bigint; secret: bigint } {
        const nullifier = BigInt('0x' + randomBytes(31).toString('hex'));
        const secret = BigInt('0x' + randomBytes(31).toString('hex'));
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

    async saveSecrets(
        nullifier: bigint,
        secret: bigint,
        commitment: bigint,
        filepath: string,
        leafIndex?: number
    ): Promise<void> {
        const data = {
            nullifier: nullifier.toString(),
            secret: secret.toString(),
            commitment: commitment.toString(),
            leafIndex: leafIndex ?? 0,
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    }

    async loadSecrets(filepath: string): Promise<{
        nullifier: bigint;
        secret: bigint;
        commitment: bigint;
        leafIndex: number;
    }> {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

        return {
            nullifier: BigInt(data.nullifier),
            secret: BigInt(data.secret),
            commitment: BigInt(data.commitment),
            leafIndex: data.leafIndex ?? 0,
        };
    }

    computeMerkleRoot(leaf: bigint, pathIndices: number[], pathElements: bigint[]): bigint {
        let current = leaf;
        for (let i = 0; i < pathIndices.length; i++) {
            const pathElement = pathElements[i];
            const pathIndex = pathIndices[i];
            if (pathIndex === 0) {
                current = this.mimc.F.toObject(this.mimc.multiHash([current, pathElement]));
            } else {
                current = this.mimc.F.toObject(this.mimc.multiHash([pathElement, current]));
            }
        }
        return current;
    }
}
