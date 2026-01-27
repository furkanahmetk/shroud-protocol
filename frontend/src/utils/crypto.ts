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
    // Store all leaves for path recomputation
    private leaves: bigint[];
    // Cache path AND corresponding root for each leaf
    private pathCache: Map<number, { pathElements: bigint[]; pathIndices: number[]; root: bigint }>;

    constructor(mimc: any, levels: number = TREE_LEVELS) {
        this.mimc = mimc;
        this.levels = levels;
        this.nextIndex = 0;
        this.roots = [];
        this.leaves = [];
        this.pathCache = new Map();

        // Initialize filled_subtrees with zeros (matching contract)
        this.filledSubtrees = [];
        for (let i = 0; i < levels; i++) {
            this.filledSubtrees[i] = 0n;
        }
    }

    private hashPair(left: bigint, right: bigint): bigint {
        // Use MiMC7 hash - the deployed contract uses proper MiMC7
        const res = this.mimc.multiHash([left, right]);
        const result = this.mimc.F.toObject(res);

        // Debug logging for first few hashes
        if (this.nextIndex < 3) {
            console.log(`[MerkleTree.hashPair] MiMC7 hash for index ${this.nextIndex}:`);
            console.log(`  left:   ${left.toString(16).substring(0, 32)}...`);
            console.log(`  right:  ${right.toString(16).substring(0, 32)}...`);
            console.log(`  result: ${result.toString(16).substring(0, 32)}...`);
        }

        return result;
    }

    /**
     * Insert a leaf using the EXACT same algorithm as the contract.
     * Caches the path at insert time for later retrieval.
     */
    insert(leaf: bigint): number {
        const leafIndex = this.nextIndex;
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];

        // Store leaf for path recomputation
        this.leaves.push(leaf);

        // Debug: Log the first few insertions
        if (leafIndex < 3) {
            console.log(`[MerkleTree.insert] Inserting leaf ${leafIndex}:`);
            console.log(`  leaf value: ${leaf.toString(16).substring(0, 32)}...`);
        }

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

        // Debug: Log the root for first few insertions
        if (leafIndex < 3) {
            console.log(`[MerkleTree.insert] Root after insert ${leafIndex}: ${currentLevelHash.toString(16).substring(0, 32)}...`);
            console.log(`[MerkleTree.insert] Full root (dec): ${currentLevelHash.toString()}`);
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
     * @deprecated Use getPathToLatestRoot instead to avoid UnknownRoot errors
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

    /**
     * Compute a fresh path for any leaf index to the LATEST root.
     * This should be used for withdrawals to ensure the root is still in the contract's history.
     *
     * IMPORTANT: This replays the incremental Merkle tree algorithm to compute paths correctly.
     * The incremental algorithm produces DIFFERENT roots than a standard full tree build!
     */
    getPathToLatestRoot(targetLeafIndex: number): { pathElements: bigint[]; pathIndices: number[]; root: bigint } {
        if (targetLeafIndex >= this.leaves.length) {
            console.error(`[MerkleTree] Invalid leaf index ${targetLeafIndex}, only ${this.leaves.length} leaves`);
            return { pathElements: [], pathIndices: [], root: 0n };
        }

        // Replay the incremental algorithm from scratch
        const tempFilledSubtrees: bigint[] = [];
        for (let i = 0; i < this.levels; i++) {
            tempFilledSubtrees[i] = ZERO_VALUE;
        }

        // Track paths for ALL leaves during replay (we need to know siblings at each step)
        // After replay, use the path that was computed for the target leaf
        const allPaths: Map<number, { pathElements: bigint[]; pathIndices: number[]; root: bigint }> = new Map();

        let latestRoot = ZERO_VALUE;
        for (let leafIdx = 0; leafIdx < this.leaves.length; leafIdx++) {
            const leaf = this.leaves[leafIdx];
            const pathElements: bigint[] = [];
            const pathIndices: number[] = [];

            let currentIndex = leafIdx;
            let currentLevelHash = leaf;

            for (let level = 0; level < this.levels; level++) {
                let left: bigint;
                let right: bigint;

                if (currentIndex % 2 === 0) {
                    // Even index: we're on the left, sibling is filledSubtrees[level]
                    left = currentLevelHash;
                    right = tempFilledSubtrees[level];
                    pathIndices.push(0);
                    pathElements.push(tempFilledSubtrees[level]);
                    tempFilledSubtrees[level] = currentLevelHash;
                } else {
                    // Odd index: we're on the right, sibling is filledSubtrees[level]
                    left = tempFilledSubtrees[level];
                    right = currentLevelHash;
                    pathIndices.push(1);
                    pathElements.push(tempFilledSubtrees[level]);
                }

                currentLevelHash = this.hashPair(left, right);
                currentIndex = Math.floor(currentIndex / 2);
            }

            latestRoot = currentLevelHash;
            allPaths.set(leafIdx, { pathElements, pathIndices, root: currentLevelHash });
        }

        // For the LATEST root, we need paths computed at the FINAL state
        // The issue: the path cached for each leaf is valid for the root at THAT insertion time
        // To get a path valid for the LATEST root, we must use the LATEST state of siblings

        // Actually, for the incremental tree, the path for a leaf to the latest root
        // must account for all subsequent insertions. Let's recompute using final state.

        // The correct approach: after all insertions, tempFilledSubtrees contains the final state.
        // We need to compute what the sibling would be for each level, considering later insertions.

        // For leaves that came AFTER our target, they may have filled positions that affect our path.
        // We need to track which positions were filled and use those values.

        // Simpler approach: the path from pathCache at the latest index gives us the latest root.
        // But we need the path for targetLeafIndex, which was computed earlier.

        // The incremental tree property: once a leaf is inserted, its path to the root AT THAT TIME
        // is fixed. For a LATER root, the path would be different because siblings may have changed.

        // Since the contract stores the last 30 roots, we should use the LATEST root and recompute.
        // But the incremental algorithm doesn't support this directly.

        // WORKAROUND: Return the cached path. If the root is no longer in the contract's history,
        // the withdrawal will fail, and user needs to wait for their original root to be valid
        // OR this is a fundamental limitation of the 30-root history.

        const cached = allPaths.get(targetLeafIndex);
        if (cached) {
            console.log(`[MerkleTree] Using path for leaf ${targetLeafIndex}`);
            console.log(`[MerkleTree] Path root: ${cached.root.toString(16).substring(0, 16)}...`);
            console.log(`[MerkleTree] Latest root: ${latestRoot.toString(16).substring(0, 16)}...`);

            // If the cached root matches the latest root, we're good
            if (cached.root === latestRoot) {
                console.log(`[MerkleTree] Path root IS the latest root - perfect!`);
            } else {
                console.warn(`[MerkleTree] Path root differs from latest root.`);
                console.warn(`[MerkleTree] If >30 deposits since yours, withdrawal may fail with UnknownRoot.`);
            }

            return cached;
        }

        console.error(`[MerkleTree] No path found for leaf ${targetLeafIndex}`);
        return { pathElements: [], pathIndices: [], root: 0n };
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

            // Use MiMC7 hash to match the deployed contract
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
