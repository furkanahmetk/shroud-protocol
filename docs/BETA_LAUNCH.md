# Shroud — Public Testnet Beta Launch Checklist

**Status:** Draft, gating engineering work complete
**Roadmap task:** #9 (P2)
**Target launch:** When all gating items below are green

The Phase 1 engineering is done (commission fee, batch transfers, real
verifier, cspr.cloud-only data, compact proof encoding). This checklist is
the operational wrapper for inviting public users.

---

## 1. Gating items (must be green before announcement)

### Code
- [x] Phase 1 features deployed to testnet (`0585ceff…`).
- [x] Real Groth16 verifier active (mock decommissioned).
- [x] Single + batch deposit/withdraw end-to-end verified.
- [ ] Frontend Withdraw form actually exercised by a wallet user via cspr.click
      (CLI is verified; UI hand-test still pending).
- [ ] Frontend Statistics page renders the new `Withdrawal` event shape
      (with `relayer`, `relayer_fee`, `protocol_fee` fields).

### Infrastructure
- [x] `CSPR_CLOUD_API_TOKEN` set in production env (Vercel or chosen host).
- [ ] Production frontend deployed to a stable URL (Vercel project + custom
      domain, e.g. `app.shroud.example`).
- [ ] Status page or simple uptime monitor (Better Uptime / StatusCake) on
      the frontend + cspr.cloud proxy.
- [ ] Sentry (or equivalent) wired up for frontend runtime errors;
      verify a deliberate test error reaches the dashboard.

### Documentation
- [ ] User-facing **Getting Started** page: install Casper Wallet, get
      testnet CSPR from the faucet, deposit 100 CSPR, save the secret,
      withdraw to a fresh address.
- [ ] **FAQ** covering: what privacy does a single deposit give you?, batch
      withdraw anonymity caveats, fee breakdown (25 bps protocol fee), what
      happens if I lose the secret JSON file, why is testnet not mainnet.
- [ ] **Known limitations** page (mock-verifier era contracts on testnet
      are still queryable — clarify which contract hash is current; flag
      the single-contributor MPC; flag the 30-root replay window).

### Privacy / safety
- [ ] Add the **anonymity-set warning** to the UI: deposits before a critical
      mass (~50) give weak privacy. Show running anonymity set size on the
      Withdraw page.
- [ ] Batch withdraw UI (if added) must show the cross-link warning before
      the user signs.

### Comms
- [ ] Announcement post (Casper Discord, X / Twitter, Casper forum).
- [ ] Feedback channel: a Discord channel + a GitHub Issues template.
- [ ] On-call rotation: at least one engineer reachable for the first 48h.

---

## 2. Soft-launch sequence

Don't drop a public link cold. Tiered exposure surfaces bugs without
burning the announcement budget.

1. **Internal (Day 0):** 3–5 team/friend wallets do a full deposit + withdraw
   cycle. Confirm Statistics page + on-chain transfers visually.
2. **Closed beta (Day 1–3):** Discord opt-in list, 20–30 users.
3. **Public beta (Day 4+):** announcement post.
4. **Hold mainnet language** until audit + MPC are done.

---

## 3. Monitoring during beta

These are the metrics that decide whether the beta is healthy:

| Metric | Source | Alert threshold |
|---|---|---|
| Failed `withdraw` rate | cspr.cloud deploy stream | > 5% over rolling 1h |
| Median gas per `withdraw` | cspr.cloud | > 400 CSPR (real verifier baseline ~300) |
| Frontend 5xx rate | Vercel logs | > 1% |
| `/api/proxy` cspr.cloud error rate | proxy logs (look for `[Proxy] cloud status=4xx/5xx`) | > 2% |
| Anonymity set size | derived from on-chain Deposit events | report-only, no alert |
| Sentry new error count | Sentry | any new error spike |

Daily standup during the first week. Slip to weekly once stable.

---

## 4. Issue triage (feeds task #11)

- GitHub Issues template with severity (critical/high/medium/low) + repro
  steps + contract hash + tx hash.
- Critical / High → fix within 24h, hotfix deploy.
- Medium / Low → batched into the next iteration.
- Bug bounty submissions (task #10) go through the same triage but with the
  bounty-program disclosure timeline.

---

## 5. Exit criteria for "beta over → audit-ready"

- [ ] At least N=50 unique depositors (anonymity-set seed)
- [ ] At least N=20 successful withdrawals
- [ ] Zero unresolved Critical / High issues for 14 consecutive days
- [ ] All triaged Medium issues either fixed or explicitly accepted with
      rationale in `docs/RISK_REGISTER.md`
- [ ] Architecture seal commit tagged (`phase-1-sealed`) — this is the
      handoff to the audit firm

Once those are green, the codebase is ready for the audit kickoff
(task #12) and we can move toward Phase 3.

---

## 6. Announcement draft

> **Subject:** Shroud Privacy Protocol — Public testnet beta open
>
> We just opened the public testnet beta for Shroud, a privacy mixer on
> Casper Network. Deposit 100 CSPR with a one-shot secret, withdraw later
> to any address. Real Groth16 zk-SNARK verification — testnet contract
> [`0585ceff…`](https://testnet.cspr.live/contract-package/0585ceff379fa73cf371b0ec868a866b11f3301e5a2eceee3085763b0e7c1400).
>
> **Try it:** [app URL]
> **Get testnet CSPR:** https://testnet.cspr.live/tools/faucet
> **Docs:** [docs URL]
> **Found a bug?** [issues URL] (bug bounty program coming alongside —
> stay tuned).
>
> **Important caveats:**
> - This is testnet. Do not put real value at risk.
> - The trusted setup is currently single-contributor — production-grade
>   ceremony comes in Phase 3.
> - Privacy depends on the anonymity set. Wait for more deposits before
>   withdrawing if you want strong unlinkability.
>
> Feedback: [Discord link]
