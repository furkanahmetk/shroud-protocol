# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Commission Fee Integration (Roadmap Phase 1)

Implements the fee-sharing mechanism described in `ROADMAP.md:11-13`. The
existing `withdraw.circom` already had `relayer` and `fee` as public inputs
(with anti-tampering constraints), so no circuit changes or new trusted
setup were required.

#### Added
- `PROTOCOL_FEE_BPS = 25` (0.25%) and `BPS_DENOMINATOR = 10_000` constants in
  `contracts/src/shroud_protocol.rs`.
- `treasury: Var<Address>` storage, set immutably in `init(treasury)`.
- `get_treasury()` and `get_protocol_fee_bps()` view methods.
- New error variant `FeeTooHigh = 6` for when `relayer_fee + protocol_fee >= DENOMINATION`.
- Unit tests `fee_math_tests` covering protocol fee math and the FeeTooHigh gate.
- CLI flags `--relayer <key>` and `--fee <motes>` on the `withdraw` command
  (both optional; default is self-withdrawal with zero relayer fee).

#### Changed
- `withdraw` entrypoint signature now takes `relayer: Address` and `fee: U512`
  in addition to the existing args. Recipient receives
  `DENOMINATION - relayer_fee - protocol_fee`; relayer receives `fee`; treasury
  receives `protocol_fee`.
- `Withdrawal` event now includes `relayer`, `relayer_fee`, `protocol_fee`.
- `Verifier::verify` signature gained `relayer: Address, fee: U512`. Real
  verifier (`verifier.rs`) now forwards these into the Groth16 public inputs
  instead of zero-padding.
- Frontend `createWithdrawTransaction` and `Withdraw.tsx` send `relayer` and
  `fee` args; self-withdrawal sets `relayer = recipient` and `fee = 0`.
- CLI `BlockchainClient.withdraw` and `withdraw.ts` plumb relayer + fee end to end.
- `bin/deploy.rs` takes an optional `SHROUD_TREASURY_ADDRESS` env var (defaults
  to deployer's account).

#### Notes
- This change is **not yet deployed to testnet**. The existing testnet contract
  (`eab05369…`) still has the old signature. Existing v1.2.0 clients will keep
  working against the deployed contract; the updated clients require a redeploy.
- The mock verifier still accepts every proof. Tracked in roadmap task #16 as
  a separate mainnet blocker.

### Batch Transfer (Roadmap Phase 1)

Implements `ROADMAP.md:20-21` — batch deposit/withdraw for users managing
multiple commitments. Uses the existing circuit (one proof per item), no new
trusted setup required.

#### Added
- `deposit_batch(commitments: Vec<U256>)` entrypoint (payable; requires
  `attached_value == N * DENOMINATION`).
- `withdraw_batch(...)` entrypoint accepting parallel Vec arrays of proofs,
  roots, nullifier_hashes, recipients, relayers, fees.
- `MAX_BATCH_SIZE = 10` constant, error variants `InvalidBatchSize = 7` and
  `BatchLengthMismatch = 8`.
- `src/deposit_session_batch.rs` session-WASM wrapper for the batch deposit
  flow (parallels existing `deposit_session.rs`).
- CLI commands `deposit-batch --count N --output-dir <dir>` and
  `withdraw-batch --secrets-dir <dir> --recipient <key>`.
- Unit tests for batch size limit and `N * DENOMINATION` amount math.

#### Privacy notes
- Batching N **deposits** does NOT degrade anonymity (commitments are public
  anyway); it just saves N−1 deploy fees.
- Batching N **withdrawals** links them via the shared payer + block. Intended
  for users consolidating their OWN multiple deposits to a single recipient.
  For cross-counterparty mixing, use independent withdrawal transactions.

#### Gas
- Batch withdraw payment scales linearly with N (verifier dominates cost).
- Batch deposit saves the per-tx overhead but each leaf still costs a full
  Merkle insert.

### Deprecate Legacy Explorer Fallback (Roadmap Phase 1)

Implements `ROADMAP.md:16-19`. The frontend's `/api/proxy` is now cloud-only;
the legacy explorer (`api.testnet.cspr.live`) fallback has been removed. Wallet
integration was already on cspr.click (no legacy `window.casperlabsHelper`
calls anywhere in the codebase).

#### Removed
- `DataSource = 'cloud' | 'legacy'` type and the entire legacy branch from
  `frontend/src/pages/api/proxy.ts` (~80 lines).
- `LEGACY_EXPLORER_API_URL` and `CSPR_DATA_SOURCE_MODE` env vars (no longer
  read anywhere).
- Legacy fallback assertions from `proxy.test.ts`; replaced with cloud-only
  upstream-error and missing-token-rejection tests.
- References to the removed env vars from `README.md` and `DEPLOYMENT.md`.

#### Changed
- `CSPR_CLOUD_API_TOKEN` is now **required** for the explorer proxy. Missing
  token → HTTP 500 `Server Misconfiguration` (was: silent legacy fallback).
- Response headers simplified: `x-shroud-data-source: cloud` always; the
  obsolete `x-shroud-fallback-used` is removed.

#### Verified
- `npx jest` (frontend): 57 pass, 1 skip, 0 fail.
- Live smoke: `/api/proxy?useExplorer=true&path=…` returns 200 with
  `src=cloud`; token-stripped variant returns 500 with the expected error.
- Home + Statistics pages load against real cspr.cloud data.

#### Not changed
- CLI's `cli/src/{blockchain,economics}.ts` still default to
  `https://api.testnet.cspr.live` for on-chain reads. The roadmap entry
  specifically called out the **frontend proxy** and **wallet scripts**; the
  CLI explorer dependency is a separate migration that can land in Phase 2
  without breaking existing scripts.

### Compact Binary Proof Encoding (Groth16)

Replaces snarkjs's verbose JSON proof serialization (~4 KB) with a fixed
256-byte binary layout, unblocking batch withdraw on Casper testnet (which
caps per-transaction args length) and shrinking the on-chain verifier.

#### Changed
- `contracts/src/verifier.rs` now parses a 256-byte binary proof (8 × 32-byte
  big-endian Fq elements: `A.x, A.y, B.x.c0, B.x.c1, B.y.c0, B.y.c1, C.x, C.y`).
  Verifier shrank from ~410 lines (custom JSON parser, BigInt math) to ~95 lines.
- `cli/src/proof_codec.ts` and `frontend/src/utils/proofCodec.ts` (new) convert
  snarkjs proof objects to the binary layout before transaction submission.
- CLI `withdraw` and `withdraw-batch`, frontend `Withdraw.tsx` all use the new
  encoder.

#### Verified end-to-end on testnet
- Contract `c099aa0208ed68eabfd196131fb0ccf86b650a300bff033fd18d3710f8044964`.
- Single withdraw: 2 transfers (recipient 99.75 CSPR, treasury 0.25 CSPR) —
  tx `0466c3b1664e2d1682df48d7f3d8922814c12e6c5949488b875d9b9ed2b686b5`.
- Batch withdraw N=2: 4 transfers (2×99.75 + 2×0.25) in one transaction —
  tx `e2c801696b91c90537208f6c22b0ab513e35cd910756bc986421e541cedb69e3`.
- Without binary encoding, batch withdraw N=2 was rejected by the node with
  `"the deploy had an excessive session args length"`.

#### Not yet
- The real verifier in `verifier.rs` is built and tested for the new layout,
  but `lib.rs` still routes to `verifier_mock.rs` (always returns true).
  Switching to the real verifier is tracked in roadmap task #16 and requires
  a WASM size investigation before redeploying.

### Switch to Real Groth16 Verifier (Roadmap P0)

Replaces the mock verifier (`verifier_mock.rs` — always returns `true`) with
the real `ark-groth16` + `ark-bn254` pairing-based verifier. This was the
single biggest mainnet blocker: with the mock active, any party that knew a
deposit's commitment could withdraw without proving knowledge of the secret.

#### Changed
- `contracts/src/lib.rs` now routes `pub mod verifier` to the real
  `verifier.rs` (the mock file is retained as a fallback only).
- `bin/deploy.rs` uses 750 CSPR gas (the testnet `install_upgrade` lane cap;
  500 CSPR sufficed for the mock build but the real verifier WASM needs more).
- CLI/frontend default withdraw payment bumped from 100 CSPR → 300 CSPR; a
  real Groth16 verification (three BN254 pairings) does not fit in the lower
  cap.

#### Bug fix: CLI generated proofs with the public key instead of the account hash
The legacy CLI helper called `pubKey.accountHash()`, which does not exist on
`casper-js-sdk@2.x`'s `CLPublicKey` (the v5 API has it, but the CLI ships
v2). The thrown `TypeError` was swallowed by a `try/catch` that fell back to
treating the raw public-key hex as the recipient. Every withdrawal therefore
generated a proof for `recipient = BigInt(publicKey)` while the contract
verified against `recipient = BigInt(accountHash)` — a guaranteed
`InvalidProof` revert.

Fixed by switching to `pubKey.toAccountHash()` (the v2 method name) in both
`cli/src/withdraw.ts` and `cli/src/withdraw_batch.ts`, and removing the
silent catch so the next API drift surfaces immediately.

#### WASM size envelope
- Mock verifier build: ~314 KB
- Real verifier build (`-Oz` + `wasm-opt --llvm-memory-copy-fill-lowering`): ~524 KB
- Both fit comfortably in Casper testnet's deploy lane.

#### Verified end-to-end on testnet
- Contract `0585ceff379fa73cf371b0ec868a866b11f3301e5a2eceee3085763b0e7c1400`.
- Single withdraw with real verifier: tx `fb0ecfd25a65573080b7975918414ff6c373f69059f0f0faa737f90ebcdfb8c9`
  — 99.75 CSPR to recipient + 0.25 CSPR to treasury (300 CSPR gas).
- Batch withdraw N=2 with real verifier: tx `70a277708767966f850872761c4cc60dc2c3196614d9d055140246e3c88fd7d1`
  — 4 transfers (2× 99.75 + 2× 0.25) in a single transaction (600 CSPR gas).

#### Test additions
- `verifies_known_good_proof_from_snarkjs` — Rust verifier accepts a proof
  captured from a successful snarkjs verify run.
- `binary_roundtrip_preserves_proof` — encoding the proof via our 256-byte
  layout and parsing it back yields a verifiable proof.

### Phase 2-3 Operational Playbooks (Roadmap)

Phase 1 engineering is complete; the rest of the roadmap is operational.
These docs are the executable plans (not just descriptions) — each ends with
a tracked checklist that gates the corresponding milestone.

- [`docs/BETA_LAUNCH.md`](docs/BETA_LAUNCH.md) — public testnet beta gating
  items, soft-launch sequence, monitoring metrics, exit criteria. Maps to
  roadmap task #9.
- [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md) — scope, severity tiers,
  payouts, submission rules, platform comparison. Self-hosted during
  testnet, migrate to Immunefi post-audit. Maps to task #10.
- [`docs/AUDIT_RFP.md`](docs/AUDIT_RFP.md) — vendor shortlist (Veridise,
  ZK Security, Trail of Bits, Halborn, OpenZeppelin, …), threat model,
  scope/out-of-scope, budget range, ready-to-paste RFP template. Maps to
  task #12.
- [`docs/MPC_CEREMONY.md`](docs/MPC_CEREMONY.md) — contributor recruitment
  buckets, tooling choice (snarkjs CLI + orchestrator), sequence with
  beacon, verification artefacts, update path to mainnet zkey. Maps to
  task #14.

All four are draft / tracking-ready. Audit RFP and MPC ceremony planning
both have long external lead times (4-8 weeks for vendors; 2-3 weeks for
contributor recruitment) and can be kicked off in parallel before the
architecture seal (#11).

### Economics Report — Early-Window Mode + Batch-Leaf Accounting (#7)

The denomination KPI tooling (`shroud-cli economics-report`) is now safe to
run from day-1 of the public beta. Previously it would have rushed toward
a `REVIEW_50` verdict during the warmup window simply because thresholds
designed for a mature anonymity set can't be met by a 7-day-old beta.

#### Added
- New `INSUFFICIENT_DATA` decision state: when the rolling 60d window holds
  fewer than `min_window_deposits` (default `14`) deposit leaves, the KPI
  metrics are still reported but the KEEP/REVIEW/FREEZE verdict is
  suppressed AND the `underperforming_weeks` counter is held in place — so
  three weak warmup weeks no longer trip `REVIEW_50` prematurely.
- CLI flag `--min-samples <n>` on `economics-report`. Default `14`. Set to
  `0` to disable the warmup gate (useful for ceremony testing).
- `DENOMINATION_POLICY.md` documents the new gate in the Weekly Decision
  Rules section.

#### Fixed
- Batch deposits (`deposit_batch`) and batch withdrawals (`withdraw_batch`)
  used to count as a single transaction in the KPI feed, undercounting the
  pool depth and `deposits_7d` metric. The CLI now extracts the leaf count
  from the `commitments` / `nullifier_hashes` list args and reflects
  that in `totalDeposits`, `windowDeposits`, `deposits7d`, and the
  pool-depth walk.

#### Verified
- Unit tests: 8/8 pass (3 new: warmup-suppression, warmup→REVIEW_50
  transition, batch leaf counting).
- Live testnet run against `0585ceff…` reports
  `decision_state=INSUFFICIENT_DATA, window_deposits=3 (1 single + 2 batch),
  recommended_denomination=100 CSPR` — exactly the safe behavior.

#### Operationally
Task #7 stays `in_progress` until the beta produces 14+ window deposits
across 60 days. The tooling no longer blocks; the data does.

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
