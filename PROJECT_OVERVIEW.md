# Shroud Protocol - Project Overview

## 🌟 Vision
Shroud Protocol is a privacy-preserving mixer on the Casper Network. It breaks the on-chain link between deposits and withdrawals using Zero-Knowledge Proofs (ZK-SNARKs).

## 🛠️ Technology Stack
- **Network**: Casper Network (Testnet: `casper-test`)
- **Smart Contracts**: Rust (Odra Framework)
- **Frontend**: Next.js 13+, React 18
- **ZK Circuits**: Circom (Groth16 Proofs + MiMC Hash)
- **Proof Generation**: `snarkjs` (Client-side in browser)
- **Interactions**: Casper JS SDK v2.15 (Wait, actually v5 logic)

## 🏗️ Core Architecture

### 1. Deposit
1.  User generates `secret` + `nullifier` locally.
2.  Frontend computes `commitment = Hash(secret, nullifier)` using MiMC7.
3.  User sends `commitment` + `100 CSPR` to the Contract.
4.  Contract appends `commitment` to the Merkle Tree.
5.  **Safety**: Secret never leaves the browser.

### 2. Withdraw
1.  User provides `secret` + `recipient_address`.
2.  Frontend syncs the Merkle Tree from the chain history.
3.  Frontend generates a ZK Proof: "I know a secret inside this Merkle Root."
4.  User sends `proof` + `nullifier_hash` to Contract.
5.  Contract verifies proof + checks nullifier (prevent double-spend).
6.  Contract releases funds to `recipient_address`.

## 🔧 Recent Optimizations & Fixes

### 1. Concurrency Fixes (Deposit)
- **Issue**: Concurrent deposits caused race conditions in `localStorage` leaf indexing.
- **Fix**: Removed local leaf tracking. Deposits are now stateless. Withdrawal logic dynamically finds the leaf index by scanning the on-chain tree.

### 2. Merkle Tree Caching
- **Issue**: Cached merkle paths became stale when new leaves were inserted.
- **Fix**: Rewrote `MerkleTree` class to store raw leaves and recompute paths on-demand, ensuring correctness regardless of tree growth.

### 3. Signing Interference
- **Issue**: Background polling (balance checks) interfered with Wallet signing actions.
- **Fix**: Implemented a global **Signing Lock** (`SpendingLock`) to pause all background activity during user interactions.

### 4. Incremental Sync & Caching
- **Issue**: App was re-fetching full history on every reload.
- **Fix**: 
    - Implemented **Incremental Sync** (fetch only items > `lastTimestamp`).
    - Added **Server-Side Cache** (5s TTL) to `proxy.ts`.
    - Fixed **Stale Closure** bug in polling timers using `useRef`.

### 5. API Rate Limits
- **Issue**: Fetching 100+ items instantly triggered `500 Errors` from Explorer API.
- **Fix**: Added **Throttle (200ms)** between requests.

### 6. Merkle Root Mismatch (Error 4)
- **Issue**: API timestamps were unreliable (drift vs block height), causing the local Merkle Tree to be built out-of-order.
- **Fix**: Enforced sorting by **Block Height** (Canonical Chain Order) to ensure the local tree matches the smart contract exactly.

## 📂 Key Files
- `frontend/src/utils/crypto.ts`: Core ZK and Merkle Tree logic.
- `frontend/src/utils/casper.ts`: Blockchain interaction and syncing.
- `frontend/src/context/CommitmentContext.tsx`: State management and syncing optimization.
- `contracts/src/shroud_protocol.rs`: Main contract logic.
