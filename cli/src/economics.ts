import { promises as fs } from 'fs';
import { BlockchainClient } from './blockchain';
import { CSPR_PER_MOTE, DENOMINATION_CSPR, DENOMINATION_LABEL } from './config';

const EXPLORER_API_URL = process.env.CASPER_EXPLORER_API_URL || 'https://api.testnet.cspr.live';
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProtocolTxType = 'deposit' | 'withdrawal';
export type DecisionState = 'KEEP_100' | 'REVIEW_50' | 'FREEZE_FOR_MAINNET';

interface ProtocolTransaction {
    hash: string;
    type: ProtocolTxType;
    timestamp: string;
    blockHeight: number;
    callerPublicKey: string | null;
    costCspr: number;
}

export interface KpiEvaluation {
    value: number;
    target: number;
    operator: '>=' | '<=';
    pass: boolean;
}

export interface EconomicsKpis {
    pool_depth_p50: KpiEvaluation;
    pool_depth_min: KpiEvaluation;
    unique_depositors_60d: KpiEvaluation;
    deposits_7d: KpiEvaluation;
    cost_ratio_p50: KpiEvaluation;
    pass_count: number;
}

export interface DecisionTracking {
    last_evaluated_week: string;
    underperforming_weeks: number;
    balanced_open_beta_weeks: number;
}

export interface EconomicsReport {
    generated_at: string;
    window_days: number;
    denomination_cspr: number;
    denomination_label: string;
    protocol_activity: {
        total_deposits: number;
        total_withdrawals: number;
        window_deposits: number;
        window_withdrawals: number;
        unique_depositors_60d: number;
    };
    kpis: EconomicsKpis;
    decision_state: DecisionState;
    recommended_denomination_cspr: number;
    decision_tracking: DecisionTracking;
    notes: string[];
}

interface Thresholds {
    poolDepthP50Min: number;
    poolDepthMinMin: number;
    uniqueDepositors60dMin: number;
    deposits7dMin: number;
    costRatioP50Max: number;
}

interface Metrics {
    totalDeposits: number;
    totalWithdrawals: number;
    windowDeposits: number;
    windowWithdrawals: number;
    uniqueDepositorCount60d: number;
    deposits7d: number;
    poolDepthP50: number;
    poolDepthMin: number;
    costRatioP50: number;
}

interface BuildOptions {
    now?: Date;
    windowDays?: number;
    denominationCspr?: number;
    openBeta?: boolean;
}

interface DepositTransfer {
    deploy_hash: string;
    timestamp: string;
    block_height?: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
    poolDepthP50Min: 180,
    poolDepthMinMin: 120,
    uniqueDepositors60dMin: 75,
    deposits7dMin: 20,
    costRatioP50Max: 0.12
};

function toWeekKey(date: Date): string {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
    return `${copy.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function parseArgValue(args: any, key: string): string | null {
    if (!args) return null;

    if (args[key]?.parsed !== undefined && args[key]?.parsed !== null) {
        return String(args[key].parsed);
    }

    if (Array.isArray(args)) {
        const tupleMatch = args.find((entry: any) => Array.isArray(entry) && entry[0] === key);
        if (tupleMatch) {
            const value = tupleMatch[1];
            if (value?.parsed !== undefined && value?.parsed !== null) {
                return String(value.parsed);
            }
            if (value !== undefined && value !== null) {
                return String(value);
            }
        }

        const objectMatch = args.find((entry: any) => entry?.name === key);
        if (objectMatch) {
            if (objectMatch.parsed !== undefined && objectMatch.parsed !== null) {
                return String(objectMatch.parsed);
            }
            if (objectMatch.value !== undefined && objectMatch.value !== null) {
                return String(objectMatch.value);
            }
        }
    }

    return null;
}

function extractArgs(data: any): any {
    return (
        data?.args ||
        data?.session?.args ||
        data?.session?.StoredContractByHash?.args ||
        data?.session?.StoredVersionedContractByHash?.args ||
        null
    );
}

function toCostCspr(rawCost: any): number {
    if (rawCost === null || rawCost === undefined) return 0;
    const parsed = Number(rawCost);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed * CSPR_PER_MOTE;
}

function normalizeBlockHeight(value: any): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

async function explorerGet(path: string): Promise<any> {
    const response = await fetch(`${EXPLORER_API_URL}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Explorer request failed (${response.status}): ${body.slice(0, 120)}`);
    }

    return response.json();
}

async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) return [];
    const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
    const results = new Array<R>(items.length);
    let cursor = 0;

    async function worker() {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) break;
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
    return results;
}

async function fetchTransfers(mainPurse: string, maxPages = 200): Promise<DepositTransfer[]> {
    const transfers: DepositTransfer[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
        const response = await explorerGet(`/purses/${mainPurse}/transfers?page_size=100&page=${page}`);
        const data = Array.isArray(response?.data) ? response.data : [];
        if (data.length === 0) break;
        transfers.push(...data);
        hasMore = data.length === 100;
        page += 1;
    }

    return transfers;
}

export async function fetchProtocolTransactions(
    nodeUrl: string,
    contractHash: string
): Promise<ProtocolTransaction[]> {
    const blockchain = new BlockchainClient(nodeUrl, contractHash);
    const mainPurse = await blockchain.getMainPurse();
    const transfers = await fetchTransfers(mainPurse);

    const hashToHeight = new Map<string, number>();
    for (const transfer of transfers) {
        const hash = transfer?.deploy_hash;
        if (!hash) continue;
        const height = normalizeBlockHeight(transfer?.block_height);
        const existing = hashToHeight.get(hash);
        if (existing === undefined || height < existing) {
            hashToHeight.set(hash, height);
        }
    }

    const uniqueHashes = Array.from(hashToHeight.keys());
    const txsOrNull = await mapWithConcurrency(uniqueHashes, 6, async (hash) => {
        try {
            const deploy = await explorerGet(`/deploys/${hash}`);
            const data = deploy?.data;
            const success = data?.status === 'processed' && !data?.error_message;
            if (!success) return null;

            const args = extractArgs(data);
            const hasCommitment = !!parseArgValue(args, 'commitment');
            const hasNullifier = !!parseArgValue(args, 'nullifier_hash');
            const entryPoint =
                data?.entry_point ||
                data?.session?.StoredVersionedContractByHash?.entry_point ||
                data?.session?.StoredContractByHash?.entry_point;
            const isWithdrawal = hasNullifier || entryPoint === 'withdraw';

            let type: ProtocolTxType | null = null;
            if (hasCommitment) {
                type = 'deposit';
            } else if (isWithdrawal) {
                type = 'withdrawal';
            }

            if (!type || !data?.timestamp) return null;

            return {
                hash,
                type,
                timestamp: data.timestamp,
                blockHeight: hashToHeight.get(hash) ?? 0,
                callerPublicKey: data?.caller_public_key ? String(data.caller_public_key) : null,
                costCspr: toCostCspr(data?.cost)
            } satisfies ProtocolTransaction;
        } catch {
            return null;
        }
    });

    return txsOrNull
        .filter((tx): tx is ProtocolTransaction => tx !== null)
        .sort((a, b) => {
            if (a.blockHeight !== b.blockHeight) return a.blockHeight - b.blockHeight;
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
}

export function computeMetrics(
    transactions: ProtocolTransaction[],
    now: Date,
    windowDays: number,
    denominationCspr: number
): Metrics {
    const nowTs = now.getTime();
    const windowStartTs = nowTs - (windowDays * DAY_MS);
    const sevenDayStartTs = nowTs - (7 * DAY_MS);

    const totalDeposits = transactions.filter((tx) => tx.type === 'deposit').length;
    const totalWithdrawals = transactions.filter((tx) => tx.type === 'withdrawal').length;

    const windowTransactions = transactions.filter((tx) => new Date(tx.timestamp).getTime() >= windowStartTs);
    const windowDeposits = windowTransactions.filter((tx) => tx.type === 'deposit');
    const windowWithdrawals = windowTransactions.filter((tx) => tx.type === 'withdrawal');

    const uniqueDepositorSet = new Set(
        windowDeposits
            .map((tx) => tx.callerPublicKey)
            .filter((key): key is string => !!key)
    );

    const deposits7d = transactions.filter((tx) =>
        tx.type === 'deposit' && new Date(tx.timestamp).getTime() >= sevenDayStartTs
    ).length;

    let depth = 0;
    let baselineCaptured = false;
    const depthSamples: number[] = [];

    for (const tx of transactions) {
        const ts = new Date(tx.timestamp).getTime();
        if (!baselineCaptured && ts >= windowStartTs) {
            depthSamples.push(depth);
            baselineCaptured = true;
        }

        if (tx.type === 'deposit') {
            depth += 1;
        } else {
            depth = Math.max(0, depth - 1);
        }

        if (ts >= windowStartTs) {
            depthSamples.push(depth);
        }
    }

    if (!baselineCaptured) {
        depthSamples.push(depth);
    }

    const depositCosts = windowDeposits.map((tx) => tx.costCspr).filter((value) => value > 0);
    const withdrawalCosts = windowWithdrawals.map((tx) => tx.costCspr).filter((value) => value > 0);

    const p50DepositCost = median(depositCosts);
    const p50WithdrawalCost = median(withdrawalCosts);
    const safeDenomination = denominationCspr > 0 ? denominationCspr : DENOMINATION_CSPR;

    return {
        totalDeposits,
        totalWithdrawals,
        windowDeposits: windowDeposits.length,
        windowWithdrawals: windowWithdrawals.length,
        uniqueDepositorCount60d: uniqueDepositorSet.size,
        deposits7d,
        poolDepthP50: median(depthSamples),
        poolDepthMin: Math.min(...depthSamples),
        costRatioP50: (p50DepositCost + p50WithdrawalCost) / safeDenomination
    };
}

export function evaluateKpis(metrics: Metrics, thresholds: Thresholds = DEFAULT_THRESHOLDS): EconomicsKpis {
    const poolDepthP50 = metrics.poolDepthP50 >= thresholds.poolDepthP50Min;
    const poolDepthMin = metrics.poolDepthMin >= thresholds.poolDepthMinMin;
    const uniqueDepositors = metrics.uniqueDepositorCount60d >= thresholds.uniqueDepositors60dMin;
    const deposits7d = metrics.deposits7d >= thresholds.deposits7dMin;
    const costRatio = metrics.costRatioP50 <= thresholds.costRatioP50Max;

    const passCount = [poolDepthP50 && poolDepthMin, uniqueDepositors && deposits7d, costRatio]
        .filter(Boolean)
        .length;

    return {
        pool_depth_p50: {
            value: Number(metrics.poolDepthP50.toFixed(2)),
            target: thresholds.poolDepthP50Min,
            operator: '>=',
            pass: poolDepthP50
        },
        pool_depth_min: {
            value: Number(metrics.poolDepthMin.toFixed(2)),
            target: thresholds.poolDepthMinMin,
            operator: '>=',
            pass: poolDepthMin
        },
        unique_depositors_60d: {
            value: metrics.uniqueDepositorCount60d,
            target: thresholds.uniqueDepositors60dMin,
            operator: '>=',
            pass: uniqueDepositors
        },
        deposits_7d: {
            value: metrics.deposits7d,
            target: thresholds.deposits7dMin,
            operator: '>=',
            pass: deposits7d
        },
        cost_ratio_p50: {
            value: Number(metrics.costRatioP50.toFixed(4)),
            target: thresholds.costRatioP50Max,
            operator: '<=',
            pass: costRatio
        },
        pass_count: passCount
    };
}

export function evaluateDecision(
    kpis: EconomicsKpis,
    previous: DecisionTracking | null,
    now: Date,
    openBeta: boolean
): { state: DecisionState; tracking: DecisionTracking } {
    const weekKey = toWeekKey(now);
    const alreadyEvaluatedThisWeek = previous?.last_evaluated_week === weekKey;
    const isBalancedPass = kpis.pass_count >= 2;

    let underperformingWeeks = previous?.underperforming_weeks ?? 0;
    let balancedOpenBetaWeeks = previous?.balanced_open_beta_weeks ?? 0;

    if (!alreadyEvaluatedThisWeek) {
        underperformingWeeks = isBalancedPass ? 0 : underperformingWeeks + 1;
        if (openBeta) {
            balancedOpenBetaWeeks = isBalancedPass ? balancedOpenBetaWeeks + 1 : 0;
        } else {
            balancedOpenBetaWeeks = 0;
        }
    }

    let state: DecisionState = 'KEEP_100';
    if (openBeta && balancedOpenBetaWeeks >= 4) {
        state = 'FREEZE_FOR_MAINNET';
    } else if (underperformingWeeks >= 3) {
        state = 'REVIEW_50';
    }

    return {
        state,
        tracking: {
            last_evaluated_week: weekKey,
            underperforming_weeks: underperformingWeeks,
            balanced_open_beta_weeks: balancedOpenBetaWeeks
        }
    };
}

function readPreviousTracking(filePath: string): Promise<DecisionTracking | null> {
    return fs.readFile(filePath, 'utf8')
        .then((raw) => JSON.parse(raw))
        .then((parsed) => parsed?.decision_tracking ?? null)
        .catch(() => null);
}

function buildNotes(state: DecisionState, openBeta: boolean): string[] {
    const notes: string[] = [
        'Decision model uses 60d balanced KPI profile from roadmap/whitepaper alignment.',
        'Single unified pool is preserved; no parallel denomination pools are recommended.'
    ];

    if (state === 'REVIEW_50') {
        notes.push('Trigger REVIEW_50 canary: run 14-day 50 CSPR testnet canary before any production denomination change.');
    }
    if (state === 'FREEZE_FOR_MAINNET') {
        notes.push('Open beta targets satisfied for 4 consecutive weeks: denomination can be frozen for mainnet launch.');
    }
    if (!openBeta) {
        notes.push('Open beta freeze rule is inactive because --open-beta was not provided.');
    }
    return notes;
}

export function buildEconomicsReport(
    transactions: ProtocolTransaction[],
    previousTracking: DecisionTracking | null,
    options: BuildOptions = {}
): EconomicsReport {
    const now = options.now ?? new Date();
    const windowDays = options.windowDays ?? 60;
    const denominationCspr = options.denominationCspr ?? DENOMINATION_CSPR;
    const openBeta = options.openBeta ?? false;

    const metrics = computeMetrics(transactions, now, windowDays, denominationCspr);
    const kpis = evaluateKpis(metrics);
    const { state, tracking } = evaluateDecision(kpis, previousTracking, now, openBeta);

    const recommendedDenomination = state === 'REVIEW_50' ? 50 : denominationCspr;

    return {
        generated_at: now.toISOString(),
        window_days: windowDays,
        denomination_cspr: denominationCspr,
        denomination_label: `${denominationCspr} CSPR`,
        protocol_activity: {
            total_deposits: metrics.totalDeposits,
            total_withdrawals: metrics.totalWithdrawals,
            window_deposits: metrics.windowDeposits,
            window_withdrawals: metrics.windowWithdrawals,
            unique_depositors_60d: metrics.uniqueDepositorCount60d
        },
        kpis,
        decision_state: state,
        recommended_denomination_cspr: recommendedDenomination,
        decision_tracking: tracking,
        notes: buildNotes(state, openBeta)
    };
}

export async function economicsReportCommand(
    nodeUrl: string,
    contractHash: string,
    outputPath: string,
    windowDays: number,
    openBeta: boolean
) {
    console.log(`📊 Building economics report for ${DENOMINATION_LABEL}...`);
    const transactions = await fetchProtocolTransactions(nodeUrl, contractHash);
    const previousTracking = await readPreviousTracking(outputPath);
    const report = buildEconomicsReport(transactions, previousTracking, {
        windowDays,
        denominationCspr: DENOMINATION_CSPR,
        openBeta
    });

    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`✅ Report saved: ${outputPath}`);
    console.log(`   Decision: ${report.decision_state}`);
    console.log(`   Recommended denomination: ${report.recommended_denomination_cspr} CSPR`);
    console.log(`   KPI pass count: ${report.kpis.pass_count}/3`);
}
