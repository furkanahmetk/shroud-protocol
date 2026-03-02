# Shroud Protocol: Security Audit Scope

This document outlines the critical components of the Shroud Protocol architecture that require rigorous independent security auditing prior to Mainnet launch.

## 1. ZK Circuit Constraints (`withdraw.circom`)

### Scope Objective
Ensure that the circuit constraints perfectly match the protocol rules and that no forged proofs can be generated.

### Key Focus Areas:
- **Nullifier Verification**: Ensure `nullifierHash` is correctly derived from `nullifier` to prevent double-spending.
- **Merkle Tree Proof**: Validate the `MerkleTreeChecker` logic and ensure `pathIndices` accurately select the correct left/right nodes during hashing.
- **Public Signal Tampering**: In `v2` implementation, `recipient`, `fee`, and `relayer` are constrained via squaring (`signal <== recipient * recipient`). Verify this effectively prevents tampering with the input values by rogue relayers.

## 2. Smart Contract Verifier Integration (`verifier.rs`)

### Scope Objective
Ensure the Odra Rust contract safely and accurately parses the input parameters and validates the Groth16 proof.

### Key Focus Areas:
- **Type Conversion Vulnerabilities**: 
  - `Address` to `Fr`: Casper `Address` (Account Hash) is converted to an Arkworks field element (`Fr`). Verify there is no precision loss or endianness mismatch between `snarkjs` and the Rust `Verifier`.
  - `U512` and `U256` to `Fr`: Verify that big integers are mapped into the BN254 field correctly modulo $p$.
- **Malleability**: Verify that the `proof_bytes` parsing strictly enforces valid $G_1$ and $G_2$ curve points.

## 3. Smart Contract State and Funds Management (`shroud_protocol.rs`)

### Scope Objective
Ensure user funds cannot be drained, locked, or double-spent via contract exploits.

### Key Focus Areas:
- **Zero-Value Deposits**: Ensure `amount` strictly equals `DENOMINATION` and fails instantly otherwise.
- **Relayer Fee Extraction**: Ensure `fee < DENOMINATION` and that math operations (`DENOMINATION - fee`) cannot underflow.
- **Nullifier Registration**: Ensure `spent_nullifiers` guarantees a nullifier is never reused under any synchronous or asynchronous call sequences.
- **Reentrancy**: Validate Odra's lack of `payable` fallbacks combined with the sequence of state updates (`spent_nullifiers` set *before* funds transferred) completely mitigates Reentrancy.
