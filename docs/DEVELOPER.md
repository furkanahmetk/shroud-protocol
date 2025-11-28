# Developer Guide

## Architecture

Shroud Protocol consists of:
1. **Smart Contracts**: Manage the Merkle Tree and verify ZK proofs.
2. **Circuits**: Generate proofs of inclusion in the Merkle Tree.
3. **Clients**: CLI and Web App to interact with the protocol.

## Building

### Circuits

```bash
cd circuits
circom withdraw.circom --r1cs --wasm --sym
snarkjs groth16 setup withdraw.r1cs pot12_final.ptau withdraw_0000.zkey
snarkjs zkey contribute withdraw_0000.zkey withdraw_final.zkey --name="Dev" -v
snarkjs zkey export verificationkey withdraw_final.zkey verification_key.json
```

### Contracts

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
```

### CLI

```bash
cd cli
npm run build
```

## Testing

### Unit Tests

- **Contracts**: `cd contracts && cargo test`
- **Circuits**: `cd circuits && npm test` (requires mocha/chai setup)

### Integration Tests

1. Deploy contracts to local network.
2. Run `deposit` command.
3. Verify event emission.
4. Run `withdraw` command.
5. Verify balance change.
