import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildEconomicsReport,
    evaluateDecision,
    evaluateKpis,
    computeMetrics
} from './economics';

const BASE_NOW = new Date('2026-03-05T10:00:00.000Z');

function tx(
    type: 'deposit' | 'withdrawal',
    daysAgo: number,
    caller: string | null,
    costCspr: number,
    blockHeight: number
) {
    return {
        hash: `${type}-${daysAgo}-${blockHeight}`,
        type,
        timestamp: new Date(BASE_NOW.getTime() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
        blockHeight,
        callerPublicKey: caller,
        costCspr
    };
}

test('computeMetrics + evaluateKpis returns expected pass/fail values', () => {
    const transactions = [
        tx('deposit', 1, 'pk1', 2, 1),
        tx('deposit', 2, 'pk2', 2, 2),
        tx('deposit', 8, 'pk3', 2, 3),
        tx('withdrawal', 1, null, 1, 4)
    ];

    const metrics = computeMetrics(transactions, BASE_NOW, 60, 100);
    const kpis = evaluateKpis(metrics);

    assert.equal(metrics.totalDeposits, 3);
    assert.equal(metrics.totalWithdrawals, 1);
    assert.equal(metrics.windowDeposits, 3);
    assert.equal(metrics.windowWithdrawals, 1);
    assert.equal(metrics.deposits7d, 2);
    assert.equal(kpis.pass_count, 1);
    assert.equal(kpis.cost_ratio_p50.pass, true);
});

test('evaluateDecision moves to REVIEW_50 after 3 underperforming weeks', () => {
    const weakKpis = {
        pool_depth_p50: { value: 0, target: 180, operator: '>=' as const, pass: false },
        pool_depth_min: { value: 0, target: 120, operator: '>=' as const, pass: false },
        unique_depositors_60d: { value: 0, target: 75, operator: '>=' as const, pass: false },
        deposits_7d: { value: 0, target: 20, operator: '>=' as const, pass: false },
        cost_ratio_p50: { value: 0.01, target: 0.12, operator: '<=' as const, pass: true },
        pass_count: 0
    };

    const week1 = evaluateDecision(weakKpis, null, new Date('2026-03-02T12:00:00.000Z'), false);
    const week2 = evaluateDecision(weakKpis, week1.tracking, new Date('2026-03-09T12:00:00.000Z'), false);
    const week3 = evaluateDecision(weakKpis, week2.tracking, new Date('2026-03-16T12:00:00.000Z'), false);

    assert.equal(week1.state, 'KEEP_100');
    assert.equal(week2.state, 'KEEP_100');
    assert.equal(week3.state, 'REVIEW_50');
    assert.equal(week3.tracking.underperforming_weeks, 3);
});

test('evaluateDecision moves to FREEZE_FOR_MAINNET after 4 open beta balanced weeks', () => {
    const balancedKpis = {
        pool_depth_p50: { value: 190, target: 180, operator: '>=' as const, pass: true },
        pool_depth_min: { value: 130, target: 120, operator: '>=' as const, pass: true },
        unique_depositors_60d: { value: 100, target: 75, operator: '>=' as const, pass: true },
        deposits_7d: { value: 25, target: 20, operator: '>=' as const, pass: true },
        cost_ratio_p50: { value: 0.1, target: 0.12, operator: '<=' as const, pass: true },
        pass_count: 3
    };

    const week1 = evaluateDecision(balancedKpis, null, new Date('2026-03-02T12:00:00.000Z'), true);
    const week2 = evaluateDecision(balancedKpis, week1.tracking, new Date('2026-03-09T12:00:00.000Z'), true);
    const week3 = evaluateDecision(balancedKpis, week2.tracking, new Date('2026-03-16T12:00:00.000Z'), true);
    const week4 = evaluateDecision(balancedKpis, week3.tracking, new Date('2026-03-23T12:00:00.000Z'), true);

    assert.equal(week4.state, 'FREEZE_FOR_MAINNET');
    assert.equal(week4.tracking.balanced_open_beta_weeks, 4);
});

test('buildEconomicsReport keeps same-week counters stable', () => {
    const transactions = [tx('deposit', 1, 'pk1', 2, 1)];
    const first = buildEconomicsReport(transactions, null, {
        now: new Date('2026-03-03T10:00:00.000Z'),
        windowDays: 60,
        denominationCspr: 100,
        openBeta: false
    });

    const second = buildEconomicsReport(transactions, first.decision_tracking, {
        now: new Date('2026-03-04T10:00:00.000Z'),
        windowDays: 60,
        denominationCspr: 100,
        openBeta: false
    });

    assert.equal(second.decision_tracking.underperforming_weeks, first.decision_tracking.underperforming_weeks);
});
