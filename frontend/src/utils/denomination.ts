const DEFAULT_DENOMINATION_CSPR = 100;
const MOTES_PER_CSPR = 1_000_000_000n;

const rawDenomination = process.env.NEXT_PUBLIC_DENOMINATION_CSPR;
const parsedDenomination = rawDenomination ? Number.parseInt(rawDenomination, 10) : NaN;

export const DENOMINATION_CSPR =
    Number.isFinite(parsedDenomination) && parsedDenomination > 0
        ? parsedDenomination
        : DEFAULT_DENOMINATION_CSPR;

export const DENOMINATION_MOTES = BigInt(DENOMINATION_CSPR) * MOTES_PER_CSPR;
export const DENOMINATION_LABEL = `${DENOMINATION_CSPR} CSPR`;
