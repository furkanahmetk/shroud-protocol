import { buildMimc7 } from 'circomlibjs';

const TREE_LEVELS = 20;
const STORAGE_KEY_PREFIX = 'shroud_commitments_';

// CRITICAL: Must match contract's ZERO_VALUE = U256::zero()
const ZERO_VALUE = 0n;

/**
 * MerkleTree implementation that EXACTLY matches the on-chain contract's
 * incremental insertion algorithm using filled_subtrees.
 * 
 * CRITICAL: The contract uses an incremental algorithm that produces DIFFERENT
 * roots than standard full-tree building. We must cache paths during insert
 * and return them from getPath, matching how the contract computes roots.
 */
export class MerkleTree {
    private mimc: any;
    private levels: number;
    private filledSubtrees: bigint[];
    private nextIndex: number;
    private roots: bigint[];
    // Cache path AND corresponding root for each leaf
    private pathCache: Map<number, { pathElements: bigint[]; pathIndices: number[]; root: bigint }>;

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

    /**
     * Insert a leaf using the EXACT same algorithm as the contract.
     * Caches the path at insert time for later retrieval.
     */
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

        // Store the path AND the root for this leaf
        this.pathCache.set(leafIndex, { pathElements, pathIndices, root: currentLevelHash });

        // Store the root (keep last 30 roots like the contract)
        this.roots.push(currentLevelHash);
        if (this.roots.length > 30) {
            this.roots.shift();
        }

        this.nextIndex++;
        return leafIndex;
    }

    /**
     * Get the latest root (after all inserts)
     */
    getRoot(): bigint {
        if (this.roots.length === 0) {
            return 0n;
        }
        return this.roots[this.roots.length - 1];
    }

    /**
     * Get the path for a specific leaf index.
     * Returns the path that was cached at insert time, along with the corresponding root.
     * IMPORTANT: Use the returned root, not getRoot(), to ensure path-root consistency.
     */
    getPath(leafIndex: number): { pathElements: bigint[]; pathIndices: number[]; root: bigint } {
        const cached = this.pathCache.get(leafIndex);
        if (cached) {
            return cached;
        }
        // Fallback: return zeros (shouldn't happen if insert was called)
        console.warn(`[MerkleTree] No cached path for index ${leafIndex}, returning zeros`);
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];
        for (let i = 0; i < this.levels; i++) {
            pathElements.push(0n);
            pathIndices.push(0);
        }
        return { pathElements, pathIndices, root: 0n };
    }
}

export class CryptoUtils {
    private mimc: any;

    constructor() {
    }

    async init() {
        this.mimc = await buildMimc7();
    }

    /**
     * Create a new MerkleTree instance
     */
    createMerkleTree(): MerkleTree {
        return new MerkleTree(this.mimc, TREE_LEVELS);
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

    /**
     * Save a commitment to localStorage cache for a specific contract
     * Returns the leaf index of the commitment
     */
    saveCommitmentToCache(contractHash: string, commitment: bigint): number {
        const key = STORAGE_KEY_PREFIX + contractHash.substring(0, 8);
        let commitments: string[] = [];

        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                commitments = JSON.parse(stored);
            }
        } catch (e) {
            commitments = [];
        }

        const leafIndex = commitments.length;
        commitments.push(commitment.toString());
        localStorage.setItem(key, JSON.stringify(commitments));

        console.log(`[CryptoUtils] Saved commitment to cache at index ${leafIndex}`);
        return leafIndex;
    }

    /**
     * Load all commitments from localStorage cache for a specific contract
     */
    loadCommitmentsFromCache(contractHash: string): bigint[] {
        const key = STORAGE_KEY_PREFIX + contractHash.substring(0, 8);

        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const data = JSON.parse(stored);
                console.log(`[CryptoUtils] Loaded ${data.length} commitments from cache`);
                return data.map((c: string) => BigInt(c));
            }
        } catch (e) {
            console.warn('[CryptoUtils] Failed to load commitments from cache:', e);
        }

        return [];
    }
}
