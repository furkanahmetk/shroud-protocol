# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-01-11

### Stress Test & Frontend Update
- **Stress Test Success**: Validated 3 consecutive deposit-withdrawal cycles (Contract `eab05369...`).
  - Cycle 1 (Leaf 1): `440caf...` / `ab7588...`
  - Cycle 2 (Leaf 2): `b4209d...` / `5555ca...`
  - Cycle 3 (Leaf 3): `23a88d...` / `c5270f...`
- **CLI Improvements**:
  - Implemented local `.commitments_*.json` cache for Merkle tree reconstruction.
  - Removed manual `--leaf-index` flag (now auto-detected).
  - Fixed tree interpolation logic for valid proofs.
- **Frontend Updates**:
  - Updated `casper.ts` to `eab05369...` hash.
  - Implemented session WASM fetching for valid native CSPR deposits (`createDepositSessionTransaction`).
  - Fixed `Withdraw.tsx` to use correct `computeMerkleRoot` and proof encoding (`TextEncoder`).
  - Added support for parsing `leafIndex` from secret JSON.

## [1.1.0] - 2026-01-11

### 🎉 Major Milestone: Full On-Chain Deposit & Withdrawal Working

Successfully implemented and verified end-to-end deposit and withdrawal flows with **real CSPR token transfers** on Casper Testnet.

### Added
- **Session Code for Deposits** (`contracts/src/deposit_session.rs`)
  - Casper requires session code to transfer native CSPR to contracts
  - Implements `cargo_purse` mechanism for Odra payable entry points
  - New CLI option `--session` to specify session WASM path

- **Incremental Merkle Tree in CLI** (`cli/src/crypto.ts`)
  - Rewrote `MerkleTree` class to use `filledSubtrees` algorithm
  - Matches contract's incremental tree exactly
  - Caches path elements during insert for accurate proof generation

- **Leaf Index Tracking** 
  - Deposits now save `leafIndex` in secrets file
  - Required for correct Merkle path computation

### Fixed
- **Merkle Root Mismatch** (`User error: 4`)
  - CLI was using full tree rebuild, contract uses incremental algorithm
  - Fixed by rewriting CLI Merkle tree to match contract exactly

- **U256 Serialization Bug** (`contracts/src/merkle_tree.rs`)
  - `to_bytes()` was adding a 4-byte length prefix (CLValue format)
  - Changed to `to_little_endian()` for raw bytes matching circuit

- **Gas Optimization** (`contracts/src/mimc.rs`)
  - MiMC constants are now parsed once per transaction, not per hash
  - Reduced gas cost from >400 CSPR to ~50 CSPR

### Changed
- **CLI Deposit Command**
  - Added `--session <path>` option for session WASM
  - Added `--leaf-index <number>` option (default: 0)

### Verified Transactions
| Type | Deploy Hash | Result |
|------|-------------|--------|
| Deposit | `6d6b256e675ef1d960795d82858df8aeae71ad9f81200e16e1f817cfbad21a58` | ✅ 100 CSPR → Contract |
| Withdraw | `1f075a408c428267257edd9b3b2c4bee6687dbbca811291b1a987af155f4bbce` | ✅ 100 CSPR → Recipient |

### Contract Deployment
- **Latest Contract Hash**: `35786c3636ef9c60c82dada99c94aa81a6c49ffaceaed2e6f157189dff161733`
- **Network**: Casper Testnet

---

## [1.0.0] - 2025-11-28

### Added
- Initial implementation of Shroud Protocol
- Smart contracts using Odra framework
- ZK circuits using Circom
- CLI for deposit/withdraw operations
- Next.js frontend with Casper Wallet integration
