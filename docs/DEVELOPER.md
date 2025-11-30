# Developer Guide

## Architecture

Shroud Protocol consists of:
1. **Smart Contracts**: Manage the Merkle Tree and verify ZK proofs.
2. **Circuits**: Generate proofs of inclusion in the Merkle Tree.
3. **Clients**: CLI and Web App to interact with the protocol.

## Building

### Circuits

```bash
# Install Circom (if not already installed)
cargo install --git https://github.com/iden3/circom.git

cd circuits
circom withdraw.circom --r1cs --wasm --sym --c
# Note: Trusted setup steps below require snarkjs
# npm install -g snarkjs
snarkjs groth16 setup withdraw.r1cs pot12_final.ptau withdraw_0000.zkey
snarkjs zkey contribute withdraw_0000.zkey withdraw_final.zkey --name="Dev" -v
snarkjs zkey export verificationkey withdraw_final.zkey verification_key.json
```

### Contracts

Using Odra framework:

```bash
cd contracts
# Build for WASM
cargo odra build
# Run tests
cargo odra test
```

### CLI

```bash
cd cli
npm run build
```

## Testing

### Unit Tests

- **Contracts**: `cd contracts && cargo odra test`
  > **Note**: Tests are currently disabled in `src/lib.rs` to ensure stable builds in environments without `cargo-odra`. To run them:
  > 1. Install `cargo-odra`: `cargo install cargo-odra`
  > 2. Uncomment `mod tests;` in `src/lib.rs`
  > 3. Run `cargo odra test`
- **Circuits**: `cd circuits && npm test` (requires mocha/chai setup)

### Integration Tests

1. Deploy contracts to local network.
2. Run `deposit` command.
3. Verify event emission.
4. Run `withdraw` command.
5. Verify balance change.
