/**
 * Free-tier headroom estimate for 1000 MAU (issue #425).
 * Uses conservative constants; see docs/SSOT/FREE_TIER_LIMITS.md.
 */

/** @typedef {{ targetMau: number; sessionsPerUserPerMonth: number; rpcsPerGroupsListOpen: number }} MauModel */

/** @type {Readonly<Record<string, number>>} */
export const FREE_TIER_MONTHLY_CAPS = {
    supabaseDbMb: 500,
    supabaseEgressGb: 5,
    supabaseEdgeInvocations: 2_000_000,
    vercelBandwidthGb: 100,
    posthogEvents: 1_000_000,
    sentryErrors: 5_000,
};

/**
 * @param {MauModel} model
 * @param {{ avgRpcPayloadKb?: number; avgRpcsPerSession?: number }} [opts]
 */
export function estimateMonthlyRpcVolume(model, opts = {}) {
    const avgRpcsPerSession = opts.avgRpcsPerSession ?? model.rpcsPerGroupsListOpen + 4;
    const sessions = model.targetMau * model.sessionsPerUserPerMonth;
    const rpcCalls = sessions * avgRpcsPerSession;
    const avgRpcPayloadKb = opts.avgRpcPayloadKb ?? 8;
    const egressGb = (rpcCalls * avgRpcPayloadKb * 2) / (1024 * 1024);
    return { sessions, rpcCalls, egressGb };
}

/**
 * @param {number} used
 * @param {number} cap
 */
export function utilizationPct(used, cap) {
    if (cap <= 0) return 0;
    return (used / cap) * 100;
}

/**
 * @param {MauModel} model
 */
export function summarizeHeadroom(model) {
    const { sessions, rpcCalls, egressGb } = estimateMonthlyRpcVolume(model);
    const posthogOpens = model.targetMau * model.sessionsPerUserPerMonth;
    return {
        sessions,
        rpcCalls,
        supabase: {
            rpcCallsVsEdgeCapPct: utilizationPct(rpcCalls, FREE_TIER_MONTHLY_CAPS.supabaseEdgeInvocations),
            estimatedEgressGb: egressGb,
            egressVsCapPct: utilizationPct(egressGb, FREE_TIER_MONTHLY_CAPS.supabaseEgressGb),
        },
        posthog: {
            appOpenEvents: posthogOpens,
            vsCapPct: utilizationPct(posthogOpens, FREE_TIER_MONTHLY_CAPS.posthogEvents),
        },
        verdict:
            rpcCalls < FREE_TIER_MONTHLY_CAPS.supabaseEdgeInvocations * 0.7 &&
            egressGb < FREE_TIER_MONTHLY_CAPS.supabaseEgressGb * 0.7
                ? 'comfortable'
                : 'review-at-70pct',
    };
}
