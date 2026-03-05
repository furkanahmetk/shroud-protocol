# Denomination Decision Policy

This policy operationalizes roadmap + whitepaper guidance for fixed-denomination finalization while preserving a single unified pool.

## Baseline

- `Default fixed denomination`: `100 CSPR`
- `Window`: rolling `60 days`
- `Profile`: balanced (privacy + adoption + cost)
- `Cadence`: weekly report

## KPI Gates

`Privacy`
- `pool_depth_p50 >= 180`
- `pool_depth_min >= 120`

`Adoption`
- `unique_depositors_60d >= 75`
- `deposits_7d >= 20`

`Cost`
- `(p50_deposit_cost + p50_withdraw_cost) / denomination <= 0.12`

## Weekly Decision Rules

- If at least 2/3 gate groups pass: `KEEP_100`
- If fewer than 2/3 pass for 3 consecutive weeks: `REVIEW_50`
- During Open Beta, if at least 2/3 pass for 4 consecutive weeks: `FREEZE_FOR_MAINNET`

## REVIEW_50 Canary Rule (Testnet, 14 days)

Move from review to actual 50 CSPR adoption only if all three pass:

- `unique_depositors` increases by at least 25%
- `pool_depth_p50` drops by at most 15%
- `cost_ratio_p50 <= 0.20`

If any fail, keep `100 CSPR`.

## Pool Integrity Rule

- Never run multiple active denomination pools in parallel.
- If denomination ever changes, deploy a new pool and keep previous pool `withdraw-only` until drained.
