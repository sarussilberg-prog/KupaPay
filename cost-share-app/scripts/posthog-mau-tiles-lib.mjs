/**
 * PostHog MAU dashboard insight builders (#422 / #584).
 * Pure helpers + API shapes; no secrets.
 */

export const MAU_DASHBOARD_NAME = 'KupaPay MAU (1000 epic)';
export const MAU_INSIGHT_TAG = 'kupapay-mau-422';
export const MAU_INSIGHT_NAME_PREFIX = 'KupaPay MAU · ';

const ACTIVITY_TILES = new Set(['DAU', 'WAU', 'MAU']);

/** @param {string | undefined} name @param {string | undefined} fallback */
export function env(name, fallback) {
    const v = process.env[name]?.trim();
    return v || fallback?.trim() || '';
}

/** @returns {{ key: string, host: string, projectId: string } | null} */
export function readPostHogConfig() {
    const key =
        env('POSTHOG_PERSONAL_API_KEY') ||
        env('FREE_TIER_POSTHOG_PERSONAL_API_KEY');
    const projectId = env('POSTHOG_PROJECT_ID') || env('FREE_TIER_POSTHOG_PROJECT_ID');
    const host = (env('POSTHOG_HOST') || env('FREE_TIER_POSTHOG_HOST') || 'https://eu.i.posthog.com').replace(
        /\/$/,
        '',
    );
    if (!key || !projectId) return null;
    return { key, host, projectId };
}

/**
 * @param {string} breakdownPath e.g. properties.platform
 */
export function parseEventBreakdown(breakdownPath) {
    const raw = (breakdownPath ?? 'properties.platform').replace(/^properties\./, '');
    return { type: 'event', property: raw };
}

/**
 * Expand DAU/WAU/MAU into platform + locale insights; other tiles keep one breakdown.
 * @param {{ name: string, insight: Record<string, unknown> }[]} tiles
 */
export function expandTileSpecs(tiles) {
    /** @type {{ key: string, displayName: string, insight: Record<string, unknown> }[]} */
    const out = [];
    for (const tile of tiles ?? []) {
        const insight = tile.insight ?? {};
        const kind = insight.kind;
        if (ACTIVITY_TILES.has(tile.name) && kind === 'Trends') {
            for (const breakdown of ['properties.platform', 'properties.locale']) {
                const label = breakdown.replace('properties.', '');
                out.push({
                    key: `${tile.name}:${breakdown}`,
                    displayName: `${tile.name} (${label})`,
                    insight: { ...insight, breakdown },
                });
            }
            continue;
        }
        const breakdown = typeof insight.breakdown === 'string' ? insight.breakdown : '';
        out.push({
            key: breakdown ? `${tile.name}:${breakdown}` : tile.name,
            displayName: tile.name,
            insight,
        });
    }
    return out;
}

/** @param {{ displayName: string }} spec */
export function insightNameForSpec(spec) {
    return `${MAU_INSIGHT_NAME_PREFIX}${spec.displayName}`;
}

export const NORTH_STAR_HOGQL = `SELECT count() AS north_star_groups
FROM (
    SELECT
        properties.group_id AS group_id,
        uniqExact(distinct_id) AS authors
    FROM events
    WHERE event = 'expense_added'
      AND {filters}
      AND properties.group_id IS NOT NULL
    GROUP BY group_id
    HAVING authors >= 2
)`;

/**
 * @param {Record<string, unknown>} insight
 * @param {{ northStarHogql?: string }} [opts]
 */
export function buildInsightQuery(insight, opts = {}) {
    const kind = insight.kind;
    if (kind === 'Trends') {
        const bd = parseEventBreakdown(String(insight.breakdown ?? 'properties.platform'));
        return {
            kind: 'InsightVizNode',
            source: {
                kind: 'TrendsQuery',
                interval: insight.interval ?? 'day',
                dateRange: { date_from: '-90d' },
                filterTestAccounts: true,
                series: [
                    {
                        kind: 'EventsNode',
                        event: insight.event,
                        math: insight.math ?? 'dau',
                        name: String(insight.event),
                    },
                ],
                breakdownFilter: { breakdowns: [bd] },
                trendsFilter: { display: 'ActionsLineGraph' },
            },
        };
    }
    if (kind === 'Funnel') {
        const bd = parseEventBreakdown(String(insight.breakdown ?? 'properties.platform'));
        const steps = /** @type {string[]} */ (insight.steps ?? []);
        return {
            kind: 'InsightVizNode',
            source: {
                kind: 'FunnelsQuery',
                dateRange: { date_from: '-90d' },
                filterTestAccounts: true,
                series: steps.map((event) => ({ kind: 'EventsNode', event })),
                funnelsFilter: {
                    funnelOrderType: 'ordered',
                    funnelVizType: 'steps',
                    funnelWindowInterval: Number(insight.conversionWindowDays ?? 14),
                    funnelWindowIntervalUnit: 'day',
                },
                breakdownFilter: {
                    breakdown: bd.property,
                    breakdown_type: bd.type,
                },
            },
        };
    }
    if (kind === 'SQL') {
        const hogql = opts.northStarHogql ?? NORTH_STAR_HOGQL;
        return {
            kind: 'DataVisualizationNode',
            source: {
                kind: 'HogQLQuery',
                query: hogql,
                filters: {
                    dateRange: { date_from: 'mStart' },
                },
            },
            display: 'BoldNumber',
        };
    }
    throw new Error(`Unsupported insight kind: ${kind}`);
}

/** Stable JSON for idempotent update checks. */
export function queryFingerprint(query) {
    return JSON.stringify(sortDeep(query));
}

/** @param {unknown} value */
function sortDeep(value) {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, k) => {
                acc[k] = sortDeep(/** @type {Record<string, unknown>} */ (value)[k]);
                return acc;
            }, /** @type {Record<string, unknown>} */ ({}));
    }
    return value;
}

/** @param {number[]} dashboards @param {number} dashboardId */
export function dashboardIdsIncluding(dashboards, dashboardId) {
    const set = new Set((dashboards ?? []).map(Number));
    set.add(Number(dashboardId));
    return [...set];
}
