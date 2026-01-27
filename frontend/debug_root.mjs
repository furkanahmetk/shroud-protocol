/**
 * Debug script to trace root computation
 * Run with: node debug_root.mjs <commitment_decimal>
 *
 * Example: node debug_root.mjs 12345678901234567890
 */

const TREE_LEVELS = 20;
const ZERO_VALUE = 0n;
const U256_MAX = (1n << 256n) - 1n;

// Replicate the exact algorithm from crypto.ts
function computeRootWithLegacyHash(commitment) {
    const filledSubtrees = [];
    for (let i = 0; i < TREE_LEVELS; i++) {
        filledSubtrees[i] = ZERO_VALUE;
    }

    let currentIndex = 0; // First insert
    let currentLevelHash = commitment;

    console.log(`\n=== Computing root for commitment ===`);
    console.log(`Commitment (dec): ${commitment.toString()}`);
    console.log(`Commitment (hex): 0x${commitment.toString(16)}`);
    console.log(`\nLevel-by-level computation:`);

    for (let i = 0; i < TREE_LEVELS; i++) {
        let left, right;

        if (currentIndex % 2 === 0) {
            left = currentLevelHash;
            right = filledSubtrees[i];
            filledSubtrees[i] = currentLevelHash;
        } else {
            left = filledSubtrees[i];
            right = currentLevelHash;
        }

        // Legacy addition hash
        const prevHash = currentLevelHash;
        currentLevelHash = (left + right) & U256_MAX;

        if (i < 5) {
            console.log(`  Level ${i}: left=${left}, right=${right}`);
            console.log(`           hash = (${left} + ${right}) & U256_MAX = ${currentLevelHash}`);
        }

        currentIndex = Math.floor(currentIndex / 2);
    }

    console.log(`\n=== FINAL ROOT ===`);
    console.log(`Root (decimal): ${currentLevelHash.toString()}`);
    console.log(`Root (hex):     0x${currentLevelHash.toString(16)}`);

    // For a single insert with all zeros, root should equal commitment
    if (currentLevelHash === commitment) {
        console.log(`\n✅ Root equals commitment (expected for single insert with zero siblings)`);
    } else {
        console.log(`\n⚠️  Root differs from commitment`);
    }

    return currentLevelHash;
}

// Get commitment from command line or use test value
const args = process.argv.slice(2);
if (args.length > 0) {
    const commitment = BigInt(args[0]);
    computeRootWithLegacyHash(commitment);
} else {
    console.log("Usage: node debug_root.mjs <commitment_decimal>");
    console.log("\nExample with test commitment:");
    const testCommitment = BigInt("5233261170300319370386085858846328736737478911451874673953613863492170606314");
    computeRootWithLegacyHash(testCommitment);
}
