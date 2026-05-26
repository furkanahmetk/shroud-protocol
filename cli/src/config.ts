const DEFAULT_DENOMINATION_CSPR = 100;
const MOTES_PER_CSPR = 1_000_000_000n;

const rawDenomination = process.env.SHROUD_DENOMINATION_CSPR;
const parsedDenomination = rawDenomination ? Number.parseInt(rawDenomination, 10) : NaN;

export const DENOMINATION_CSPR =
    Number.isFinite(parsedDenomination) && parsedDenomination > 0
        ? parsedDenomination
        : DEFAULT_DENOMINATION_CSPR;

export const DENOMINATION_MOTES = BigInt(DENOMINATION_CSPR) * MOTES_PER_CSPR;
export const DENOMINATION_LABEL = `${DENOMINATION_CSPR} CSPR`;

export const DEFAULT_DEPOSIT_PAYMENT_BUFFER_MOTES = 100n * MOTES_PER_CSPR;
// Real Groth16 verification (~3 pairings on BN254) is gas-heavy; mock used <50 CSPR.
export const DEFAULT_WITHDRAW_PAYMENT_MOTES = 300n * MOTES_PER_CSPR;

export const CSPR_PER_MOTE = 1 / 1_000_000_000;
