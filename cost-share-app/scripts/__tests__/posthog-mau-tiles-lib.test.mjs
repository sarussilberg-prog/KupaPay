import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInsightQuery,
    expandTileSpecs,
    insightNameForSpec,
    parseEventBreakdown,
    queryFingerprint,
    dashboardIdsIncluding,
    NORTH_STAR_HOGQL,
} from '../posthog-mau-tiles-lib.mjs';

test('expandTileSpecs duplicates DAU/WAU/MAU for platform and locale', () => {
    const expanded = expandTileSpecs([
        { name: 'DAU', insight: { kind: 'Trends', event: 'app_open', math: 'dau', interval: 'day' } },
        { name: 'Activation funnel', insight: { kind: 'Funnel', steps: ['signup', 'expense_added'], breakdown: 'properties.platform' } },
    ]);
    assert.equal(expanded.length, 3);
    assert.ok(expanded.some((s) => s.key === 'DAU:properties.platform'));
    assert.ok(expanded.some((s) => s.key === 'DAU:properties.locale'));
    assert.equal(expanded.find((s) => s.key === 'Activation funnel:properties.platform')?.displayName, 'Activation funnel');
});

test('parseEventBreakdown strips properties prefix', () => {
    assert.deepEqual(parseEventBreakdown('properties.locale'), { type: 'event', property: 'locale' });
});

test('buildInsightQuery trends uses breakdownFilter.breakdowns', () => {
    const q = buildInsightQuery({
        kind: 'Trends',
        event: 'app_open',
        math: 'monthly_active',
        interval: 'month',
        breakdown: 'properties.platform',
    });
    assert.equal(q.kind, 'InsightVizNode');
    assert.equal(q.source.kind, 'TrendsQuery');
    assert.deepEqual(q.source.breakdownFilter.breakdowns, [{ type: 'event', property: 'platform' }]);
    assert.equal(q.source.series[0].math, 'monthly_active');
});

test('buildInsightQuery funnel window lives in funnelsFilter', () => {
    const q = buildInsightQuery({
        kind: 'Funnel',
        steps: ['signup', 'group_created', 'expense_added'],
        conversionWindowDays: 14,
        breakdown: 'properties.platform',
    });
    assert.equal(q.source.kind, 'FunnelsQuery');
    assert.equal(q.source.funnelsFilter.funnelWindowInterval, 14);
    assert.equal(q.source.breakdownFilter.breakdown, 'platform');
});

test('buildInsightQuery north star HogQL uses {filters} placeholder', () => {
    const q = buildInsightQuery({ kind: 'SQL' });
    assert.equal(q.kind, 'DataVisualizationNode');
    assert.match(q.source.query, /\{filters\}/);
    assert.match(NORTH_STAR_HOGQL, /\{filters\}/);
    assert.deepEqual(q.source.filters.dateRange, { date_from: 'mStart' });
});

test('queryFingerprint is stable regardless of key order', () => {
    const a = { b: 1, a: { z: 2, y: 3 } };
    const b = { a: { y: 3, z: 2 }, b: 1 };
    assert.equal(queryFingerprint(a), queryFingerprint(b));
});

test('insightNameForSpec prefixes managed name', () => {
    assert.equal(insightNameForSpec({ displayName: 'MAU (platform)' }), 'KupaPay MAU · MAU (platform)');
});

test('dashboardIdsIncluding dedupes', () => {
    assert.deepEqual(dashboardIdsIncluding([1, 2], 2), [1, 2]);
    assert.deepEqual(dashboardIdsIncluding([], 9), [9]);
});
