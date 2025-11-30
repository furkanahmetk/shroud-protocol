const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

describe("Withdraw Circuit Test", function () {
    this.timeout(100000);

    let circuit;
    let mimc;

    before(async () => {
        const circomlibjs = await import("circomlibjs");
        const buildMimc7 = circomlibjs.buildMimc7;
        circuit = await wasm_tester(path.join(__dirname, "../withdraw.circom"));
        mimc = await buildMimc7();
    });

    it("Should verify a valid withdrawal proof", async () => {
        // 1. Generate Secret & Nullifier
        const secret = BigInt(12345);
        const nullifier = BigInt(67890);

        // 2. Compute Commitment
        let commitment = mimc.multiHash([nullifier, secret]);
        commitment = mimc.F.toObject(commitment);

        // 3. Compute Nullifier Hash
        let nullifierHash = mimc.multiHash([nullifier]);
        nullifierHash = mimc.F.toObject(nullifierHash);

        // 4. Merkle Tree Path (Mocked for depth 20)
        const pathElements = new Array(20).fill(0n);
        const pathIndices = new Array(20).fill(0);

        // Calculate expected root
        let currentHash = commitment;
        for (let i = 0; i < 20; i++) {
            if (pathIndices[i] === 0) {
                currentHash = mimc.multiHash([currentHash, pathElements[i]]);
            } else {
                currentHash = mimc.multiHash([pathElements[i], currentHash]);
            }
            currentHash = mimc.F.toObject(currentHash);
        }
        const root = currentHash;

        // 5. Construct Input
        const input = {
            root: root,
            nullifierHash: nullifierHash,
            recipient: 111n, // Dummy recipient
            relayer: 0n,
            fee: 0n,
            nullifier: nullifier,
            secret: secret,
            pathElements: pathElements,
            pathIndices: pathIndices
        };

        // 6. Verify
        const witness = await circuit.calculateWitness(input);
        await circuit.checkConstraints(witness);
    });

    it("Should fail with invalid secret", async () => {
        const secret = BigInt(12345);
        const nullifier = BigInt(67890);
        let commitment = mimc.multiHash([nullifier, secret]);
        commitment = mimc.F.toObject(commitment);

        let nullifierHash = mimc.multiHash([nullifier]);
        nullifierHash = mimc.F.toObject(nullifierHash);

        // Path
        const pathElements = new Array(20).fill(0n);
        const pathIndices = new Array(20).fill(0);

        // Calculate root for the VALID commitment
        let currentHash = commitment;
        for (let i = 0; i < 20; i++) {
            currentHash = mimc.multiHash([currentHash, pathElements[i]]);
            currentHash = mimc.F.toObject(currentHash);
        }
        const root = currentHash;

        // Input with WRONG secret
        const input = {
            root: root,
            nullifierHash: nullifierHash,
            recipient: 111n,
            relayer: 0n,
            fee: 0n,
            nullifier: nullifier,
            secret: BigInt(99999), // Wrong secret
            pathElements: pathElements,
            pathIndices: pathIndices
        };

        try {
            await circuit.calculateWitness(input);
            assert.fail("Should have failed witness generation");
        } catch (e) {
            assert.include(e.message, "Assert Failed");
        }
    });
});
