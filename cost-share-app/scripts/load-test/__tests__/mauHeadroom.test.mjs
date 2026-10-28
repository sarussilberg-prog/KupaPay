import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateMonthlyRpcVolume, summarizeHeadroom } from '../mauHeadroom.mjs';

test('1000 MAU stays under 70% of free-tier RPC-ish caps', () => {
    const model = { targetMau: 1000, sessionsPerUserPerMonth: 20, rpcsPerGroupsListOpen: 3 };
    const summary = summarizeHeadroom(model);
    assert.ok(summary.rpcCalls < 500_000);
    assert.ok(summary.supabase.rpcCallsVsEdgeCapPct < 70);
    assert.ok(summary.supabase.egressVsCapPct < 70);
    assert.equal(summary.verdict, 'comfortable');
});

test('estimateMonthlyRpcVolume scales linearly with MAU', () => {
    const base = estimateMonthlyRpcVolume({
        targetMau: 100,
        sessionsPerUserPerMonth: 10,
        rpcsPerGroupsListOpen: 3,
    });
    const scaled = estimateMonthlyRpcVolume({
        targetMau: 1000,
        sessionsPerUserPerMonth: 10,
        rpcsPerGroupsListOpen: 3,
    });
    assert.equal(scaled.rpcCalls, base.rpcCalls * 10);
});
