# Trusted Setup (Phase 2): Multi-Party Computation Ceremony Guide

Because Shroud Protocol uses Groth16 (`snarkjs`), it requires a **Circuit-Specific Trusted Setup (Phase 2)**. 

To ensure the "toxic waste" (the underlying secrets used to generate the proving keys) is destroyed, multiple participants must contribute to the setup. As long as at least ONE participant honestly destroys their randomness, the entire system is secure.

## The Process

### 1. Preparation (Coordinator)
The coordinator generates the initial `.zkey` file using the Phase 1 `.ptau` file.
```bash
snarkjs groth16 setup withdraw.r1cs powersOfTau28_hez_final_15.ptau withdraw_0000.zkey
```

### 2. Contribution Phase
The coordinator passes the `.zkey` file sequentially to community members. Each member runs:
```bash
# Participant 1
snarkjs zkey contribute withdraw_0000.zkey withdraw_0001.zkey --name="Alice" -v -e="some random text Alice types"

# Participant 2
snarkjs zkey contribute withdraw_0001.zkey withdraw_0002.zkey --name="Bob" -v -e="some random text Bob types"

# Participant 3 (etc)
snarkjs zkey contribute withdraw_0002.zkey withdraw_0003.zkey --name="Charlie" -v -e="..."
```

### 3. Application of the Random Beacon 
After all contributions, the coordinator applies a final random beacon (e.g., the hash of a specific Bitcoin block at a specific future time).
```bash
snarkjs zkey beacon withdraw_0003.zkey withdraw_final.zkey <BeaconHash> 10 -n="Final Beacon"
```

### 4. Verification
Anyone can verify the contributions to the final `.zkey` to ensure no one bypassed the process:
```bash
snarkjs zkey verify withdraw.r1cs powersOfTau28_hez_final_15.ptau withdraw_final.zkey
```

### 5. Export Verification Key
Finally, export the `verification_key.json` and generate the Rust/Solidity verifier code based on the `withdraw_final.zkey`.
```bash
snarkjs zkey export verificationkey withdraw_final.zkey verification_key.json
```
