/**
 * Test script to verify MiMC7 implementation matches the contract
 *
 * Run with: npx ts-node src/utils/mimcTest.ts
 */

import { buildMimc7 } from 'circomlibjs';

// Expected constants from the contract's mimc.rs
const CONTRACT_CONSTANTS = [
    "0",
    "20888961410941983456478427210666206549300505294776164667214940546594746570981",
    "15265126113435022738560151911929040668591755459209400716467504685752745317193",
    "8334177627492981984476504167502758309043212251641796197711684499645635709656",
    "1374324219480165500871639364801692115397519265181803854177629327624133579404",
    // ... (first 5 constants for quick check)
];

async function testMimc() {
    console.log("Testing MiMC7 implementation...\n");

    const mimc = await buildMimc7();

    // Print first 5 constants from circomlibjs
    console.log("circomlibjs MiMC7 constants (first 5):");
    const jsConstants = mimc.F.toObject;
    // Access internal constants if possible
    // Note: circomlibjs doesn't directly expose constants, we need to test outputs

    // Test 1: Hash two zeros
    const zero = 0n;
    const hashZeros = mimc.multiHash([zero, zero]);
    const hashZerosResult = mimc.F.toObject(hashZeros);
    console.log(`\nTest 1: multiHash([0, 0])`);
    console.log(`  Result (hex): ${hashZerosResult.toString(16)}`);
    console.log(`  Result (dec): ${hashZerosResult.toString()}`);

    // Test 2: Hash [1, 2]
    const hash12 = mimc.multiHash([1n, 2n]);
    const hash12Result = mimc.F.toObject(hash12);
    console.log(`\nTest 2: multiHash([1, 2])`);
    console.log(`  Result (hex): ${hash12Result.toString(16)}`);
    console.log(`  Result (dec): ${hash12Result.toString()}`);

    // Test 3: Hash a typical commitment-like value
    const testVal = BigInt("12345678901234567890123456789012345678901234567890");
    const hashTest = mimc.multiHash([testVal, zero]);
    const hashTestResult = mimc.F.toObject(hashTest);
    console.log(`\nTest 3: multiHash([big_number, 0])`);
    console.log(`  Input: ${testVal.toString()}`);
    console.log(`  Result (hex): ${hashTestResult.toString(16)}`);
    console.log(`  Result (dec): ${hashTestResult.toString()}`);

    // Test 4: Check field size
    const fieldSize = mimc.F.p;
    console.log(`\nField size (p):`);
    console.log(`  ${fieldSize.toString()}`);
    console.log(`  Should be: 21888242871839275222246405745257275088548364400416034343698204186575808495617`);

    // Print: If we can access the round constants
    console.log("\n--- To compare with contract, add these test values to Rust ---");
    console.log("Expected multiHash([0, 0]):", hashZerosResult.toString());
    console.log("Expected multiHash([1, 2]):", hash12Result.toString());
}

testMimc().catch(console.error);
