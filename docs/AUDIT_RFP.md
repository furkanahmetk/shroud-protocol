# Shroud Protocol — Security Audit RFP

**Status:** Draft, vendor outreach pending
**Roadmap task:** #12 (P3)
**Target audit window:** 4–6 weeks
**Target start:** After Phase 2 architecture seal (#11) — engage vendors NOW for slot booking; the audit work itself starts once the codebase is frozen.

---

## 1. Project summary

Shroud is a privacy mixer on the Casper Network. Users deposit a fixed
denomination of CSPR with a commitment, then later withdraw to a fresh
recipient by proving knowledge of the corresponding secret via a Groth16
zk-SNARK over BN254. The protocol is **Tornado-Cash-derived but ported to
Casper 2.0**, with a small protocol fee routed to a treasury and an optional
relayer fee path.

**Live testnet:** `0585ceff379fa73cf371b0ec868a866b11f3301e5a2eceee3085763b0e7c1400`
**Public repo:** Shroud (current branch is the Phase 1 freeze candidate)
**License:** TBD before audit (recommend MIT or Apache-2.0)

---

## 2. Scope

| Surface | Lines (approx.) | Notes |
|---|---|---|
| **Rust smart contract** (Odra 2.5 / Casper) | ~600 | `contracts/src/{shroud_protocol,merkle_tree,mimc,verifier,vk}.rs` |
| **Session WASMs** | ~100 | `contracts/src/deposit_session{,_batch}.rs` |
| **Circom circuits** (Groth16) | ~70 | `circuits/{withdraw,merkleTree,commitment,mimc}.circom` |
| **Proving infra** | n/a | Trusted setup transcripts (current: single-contributor; MPC ceremony is task #14) |
| **Frontend & CLI ZK glue** | ~400 | snarkjs proof generation, binary proof encoding, public input derivation |
| **Off-chain indexer / proxy** | ~300 | `frontend/src/pages/api/proxy.ts` (cspr.cloud only) |

**Out of scope:**
- The Casper node, casper-types, ark-bn254, ark-groth16, snarkjs (we depend on these as upstream libraries — flag CVEs but don't deep-audit).
- Frontend UX/UI beyond the cryptographic correctness of `Withdraw.tsx` / `Deposit.tsx`.

---

## 3. Threat model

Auditors should validate against at least:

1. **Soundness** — can an attacker withdraw without a valid commitment+secret?
   - Mock-verifier history note: prior testnet builds used a `verifier_mock` that
     unconditionally returned `true`. The Phase 1 release switches to real
     Groth16 verification (`contracts/src/verifier.rs`). Confirm there is no
     residual code path to the mock.
2. **Double-spend** — nullifier replay protection (`spent_nullifiers` mapping).
3. **Fee griefing** — relayer fee + protocol fee ≥ denomination revert path
   (`Error::FeeTooHigh`).
4. **Tree poisoning** — root replay window (last 30 roots), deterministic
   leaf insertion vs. concurrent deposits.
5. **Proof tampering** — circuit binds `recipient`, `relayer`, `fee` via
   square constraints; verify the on-chain verifier consumes the same public
   inputs in the same order as the circuit declares.
6. **Encoding bugs** — the snarkjs JSON → 256-byte binary proof bridge.
   A real bug here (account hash vs. public key) was fixed in Phase 1; check
   the entire encoding/decoding surface for similar API drift hazards.
7. **Casper 2.0 specifics** — `payable` entry points, purse handling in
   `deposit_session*.wasm`, gas-lane caps, transaction-arg length limits.
8. **Anonymity-set degradation** — batch withdrawals link N withdrawals;
   confirm the contract design and UX warnings are aligned.
9. **Treasury upgradability** — `treasury` is set once at `init` and
   immutable; confirm there is no path to overwrite it.
10. **MPC trust assumption** — current zkey is from a single-contributor
    setup. The MPC ceremony (task #14) addresses this; the audit should flag
    this dependency rather than block on it.

---

## 4. Deliverables expected from the auditor

- Initial review (week 1–2): familiarization, threat-model walkthrough.
- Findings report with severity (Critical / High / Medium / Low / Info),
  exploit conditions, and remediation suggestions.
- Re-audit pass after fixes (target: 1 week).
- **Public-facing final report** suitable for publication, redacted of any
  embargoed Casper-side issues if applicable.
- Optional: written attestation we can quote in marketing materials.

---

## 5. Vendor shortlist

Ranked by ZK-circuit + pairing-friendly-curve experience first, Rust contract
experience second, Casper-specific experience third (very few firms have it —
treat as a plus, not a hard requirement).

| Vendor | ZK strength | Rust contract strength | Notes | Typical lead time |
|---|---|---|---|---|
| **Veridise** | Tier-1 (Circom, Halo2, Risc0) | Strong | Has worked on Tornado-derivative audits. Their tooling (PicusZK) catches under-constraints. | 6–8 weeks |
| **ZK Security** | Tier-1 (Circom + Groth16 specialty) | Medium | Spinout dedicated to ZK. Good for the circuit + proof bridge. | 4–6 weeks |
| **Least Authority** | Tier-1 (Aztec, Filecoin) | Strong | Long-running ZK auditors; thorough but slow. | 8–12 weeks |
| **Trail of Bits** | Tier-1 (general) | Tier-1 | Generalist, very strong on Rust + WASM, lower ZK depth than Veridise/ZK Security. | 6–10 weeks |
| **OpenZeppelin** | Medium | Tier-1 | Excellent Rust/Solidity track record; ZK depth is improving but not their main beat. | 4–8 weeks |
| **Halborn** | Medium | Medium | Casper Network has worked with them historically — possible Casper-specific knowledge. | 4–6 weeks |
| **Spearbit / Cantina** | Variable | Variable | Crowd-audit marketplace; quality depends on who claims the engagement. Useful as a complement, not a primary auditor. | 2–4 weeks |

**Recommendation:** Engage **two firms in parallel** if budget allows —
one ZK-specialist (Veridise or ZK Security) for the circuit + bridge, and
one Rust/Casper specialist (Trail of Bits or Halborn) for the contract +
session WASMs. Independent reviews catch what one firm misses.

Single-firm fallback: **Veridise** — best single-vendor coverage for our specific
stack (Circom + Rust + pairing curves).

---

## 6. Indicative budget

| Tier | Range |
|---|---|
| Single-firm full audit (Rust + circuits) | $40k – $90k |
| Two-firm parallel audit | $80k – $180k |
| Re-audit pass (per firm) | $5k – $15k |

Budget the high end; mixers warrant deeper review than the median DeFi
protocol. Pre-allocate at least 1 CSPR-denominated bounty payout reserve in
addition (task #10).

---

## 7. RFP outreach template (paste into vendor contact form)

> **Subject:** Audit RFP — Shroud Protocol (Privacy mixer on Casper, Groth16 + Rust)
>
> Hi [vendor],
>
> We're building Shroud, a fixed-denomination privacy mixer on Casper
> Network. The protocol is Phase 1 feature-complete and live on testnet
> (contract `0585ceff…`). We're scoping a security audit to land before
> mainnet.
>
> **Scope:** ~600 LOC Rust contract (Odra 2.5 / Casper 2.0), Circom Groth16
> withdraw circuit (depth-20 Merkle tree, BN254), snarkjs ↔ Rust verifier
> proof bridge, and the off-chain indexer proxy.
>
> **Target window:** [X weeks], starting around [date]. We expect to seal
> the codebase 1–2 weeks before the audit start.
>
> **Deliverables we need:** severity-tiered findings, remediation pass,
> publication-ready final report.
>
> Could you share availability, indicative cost, and your team's prior work
> on Tornado-derivative or Groth16 circuit audits?
>
> Repo access, threat model, and design docs available under NDA.
>
> Thanks,
> [name]

---

## 8. Tracking

- [ ] Send RFP to top 3 vendors (Veridise, ZK Security, Trail of Bits)
- [ ] Compare quotes + lead times; pick 1–2
- [ ] NDA + statement of work signed
- [ ] Architecture seal (depends on task #11)
- [ ] Hand over repo at sealed SHA
- [ ] Audit kickoff
- [ ] Findings → triage → fixes (task #13)
- [ ] Final report publication
