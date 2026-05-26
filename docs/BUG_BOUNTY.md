# Shroud Protocol — Mini Bug Bounty Program

**Status:** Draft, awaiting program launch
**Roadmap task:** #10 (P2)
**Target launch:** Alongside the public beta (#9), once UI hand-tests pass

A mini bounty program runs **alongside** the beta — not after. Beta surfaces
UX bugs; the bounty surfaces security bugs. Both feed into the same triage
queue (`docs/BETA_LAUNCH.md` §4) and into pre-audit hardening (#11).

---

## 1. Scope — in

| Surface | Contract / file | Notes |
|---|---|---|
| Smart contract (deployed) | `0585ceff379fa73cf371b0ec868a866b11f3301e5a2eceee3085763b0e7c1400` | All entry points: `init`, `fund`, `deposit`, `deposit_batch`, `withdraw`, `withdraw_batch`, `get_treasury`, `get_protocol_fee_bps` |
| Circuit | `circuits/withdraw.circom` (+ included circomlib templates) | Soundness, completeness, under-constraints, hash domain separation |
| Verifier + VK | `contracts/src/{verifier,vk}.rs` | Binary proof decoding, public input ordering, VK integrity |
| Session WASMs | `contracts/src/deposit_session{,_batch}.rs` | Purse handling, attached-value arithmetic |
| Frontend ZK glue | `frontend/src/components/Withdraw.tsx`, `frontend/src/utils/proofCodec.ts` | Proof generation inputs, encoding correctness, nullifier/secret handling |
| CLI ZK glue | `cli/src/{withdraw,withdraw_batch,proof_codec}.ts` | Same as above for the CLI flow |
| Off-chain indexer / proxy | `frontend/src/pages/api/proxy.ts` | Token leakage, path-bypass, response normalization |

## 2. Scope — out

- Casper node, casper-types, ark-bn254, ark-groth16, snarkjs, Circom compiler (report upstream; don't bounty unless we're shipping an unsafe combination).
- Phishing, social engineering, physical attacks, DDoS.
- Issues in deprecated contracts (`eab05369…`, `c099aa…`) — out of scope.
- Issues that only apply when the user is NOT using the official frontend/CLI (e.g. "if you fork the CLI and remove the recipient binding, you can …").
- Anonymity-set degradation at low depositor counts — already documented as a known limitation.

## 3. Severity tiers + payouts

Severity is judged on **impact × likelihood**, not just CVSS-style scoring.

| Severity | Impact | Payout (testnet CSPR equivalent) |
|---|---|---|
| **Critical** | Funds at risk: anyone can drain the contract, forge a withdraw without a valid commitment, or double-spend a nullifier | **5,000 – 25,000 CSPR** |
| **High** | Funds at risk under non-trivial preconditions: e.g. specific timing, race, or victim action; or treasury fee bypass at scale | **1,000 – 5,000 CSPR** |
| **Medium** | Privacy degradation: linkability beyond documented limitations; or partial DoS that's not trivially recoverable | **250 – 1,000 CSPR** |
| **Low** | Quality / robustness issues that don't pose a direct risk but should be fixed | **50 – 250 CSPR** |
| **Info** | Suggestions, doc gaps, style — no payout, hall of fame mention | — |

Payouts during testnet are in testnet CSPR (faucet-funded reserve). If the
mainnet launch happens (post-audit) we'll restate the bounty in mainnet CSPR
and grandfather any high-impact reports.

## 4. Submission rules

- **Email:** `security@shroud.example` (set up dedicated mailbox, GPG key
  publishable on the docs page).
- **Format:** title, severity self-estimate, repro steps with exact tx
  hashes / commit SHA, suggested mitigation, your CSPR address for payout.
- **First valid submitter wins** for the same root-cause. Forks/dupes
  receive hall-of-fame credit but no payout.
- **Disclosure timeline:** 90 days after fix is deployed, OR sooner if we
  coordinate with the reporter. Reports may be published in
  `docs/POSTMORTEMS/` after the embargo.

## 5. Rules of engagement

- Use only testnet. **Do not** attack mainnet (when it exists).
- **Do not** test against arbitrary third-party users' deposits — use your
  own testnet accounts.
- No public disclosure before fix lands.
- Automated scanners are fine, but blast traffic that affects other testnet
  users is grounds for ineligibility.
- Researchers acting in good faith within these rules are exempt from
  CFAA/equivalent claims (good-faith safe harbor).

## 6. Platform choice

| Option | Pros | Cons | Cost |
|---|---|---|---|
| **Self-hosted** (email + GitHub Security Advisory) | Cheapest, full control | Manual triage, lower discoverability | $0 |
| **Immunefi** | Highest visibility, mature triage | 10% platform fee, formal SLA | 10% of payouts |
| **Cantina** | Code4rena-style, good ZK researcher community | Less established than Immunefi | Variable |
| **HackerOne** | Generalist, large researcher pool | Less ZK / blockchain-specialized | Subscription + payout cut |

**Recommendation:** **Self-hosted for the mini-bounty phase**, migrate to
**Immunefi** post-audit when payouts become mainnet-CSPR-real. Self-hosted
keeps the cost ≈ $0 during testnet and avoids platform lock-in early.

## 7. Tracking + triage flow

```
Submission ──▶ acknowledge in 24h
                │
                ▼
       triage severity (you + 1 reviewer)
                │
                ▼
     ┌──────────┴────────────┐
     ▼                       ▼
Critical/High            Medium/Low
    │                       │
    ▼                       ▼
hotfix in 7d        next iteration
    │                       │
    └────────┬──────────────┘
             ▼
       payout + private fix note
             │
             ▼
   (90d) public disclosure in docs/POSTMORTEMS/
```

## 8. Pre-launch checklist

- [ ] `security@shroud.example` mailbox + GPG key set up
- [ ] `docs/POSTMORTEMS/` directory created (empty)
- [ ] Public program page (this doc, published on the docs site)
- [ ] Reserve wallet funded with 30,000+ testnet CSPR for payouts
- [ ] Triage rotation: 2 reviewers committed for 24h-ack SLA
- [ ] Hall-of-fame page (publish accepted reporters with their consent)

## 9. Tracking

- [ ] Send draft to 3 ZK security researchers for sanity check before launch
- [ ] Publish program page
- [ ] Announce alongside beta (#9)
- [ ] Track submissions in a private repo (or HackMD) — not in public GitHub Issues
