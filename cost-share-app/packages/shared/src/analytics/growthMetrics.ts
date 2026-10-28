/**
 * Admin growth metrics from Postgres RPC get_growth_metrics() (#422).
 * No PII — counts and month labels only.
 */

export const MAU_EPIC_TARGET = 1000;

export interface AdminGrowthNorthStar {
    definition: string;
    currentMonth: string;
    currentMonthCount: number;
    previousMonth: string;
    previousMonthCount: number;
}

export interface AdminGrowthActiveAuthors {
    dau: number;
    wau: number;
    mau: number;
    note: string;
}

export interface AdminGrowthMonthlyPoint {
    month: string;
    northStarGroups: number;
}

export interface AdminGrowthMetrics {
    asOf: string;
    northStar: AdminGrowthNorthStar;
    activeExpenseAuthors: AdminGrowthActiveAuthors;
    northStarMonthlySeries: AdminGrowthMonthlyPoint[];
}

export type GrowthMetricsRpcPayload = {
    as_of?: string;
    north_star?: {
        definition?: string;
        current_month?: string;
        current_month_count?: number | string;
        previous_month?: string;
        previous_month_count?: number | string;
    };
    active_expense_authors?: {
        dau?: number | string;
        wau?: number | string;
        mau?: number | string;
        note?: string;
    };
    north_star_monthly_series?: Array<{ month?: string; north_star_groups?: number | string }>;
};

function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function parseGrowthMetricsRpc(data: GrowthMetricsRpcPayload | null | undefined): AdminGrowthMetrics {
    const ns = data?.north_star ?? {};
    const authors = data?.active_expense_authors ?? {};
    const series = Array.isArray(data?.north_star_monthly_series) ? data.north_star_monthly_series : [];

    return {
        asOf: String(data?.as_of ?? ''),
        northStar: {
            definition: String(ns.definition ?? 'monthly_active_groups_with_two_plus_expense_authors'),
            currentMonth: String(ns.current_month ?? ''),
            currentMonthCount: num(ns.current_month_count),
            previousMonth: String(ns.previous_month ?? ''),
            previousMonthCount: num(ns.previous_month_count),
        },
        activeExpenseAuthors: {
            dau: num(authors.dau),
            wau: num(authors.wau),
            mau: num(authors.mau),
            note: String(authors.note ?? ''),
        },
        northStarMonthlySeries: series.map((row) => ({
            month: String(row.month ?? ''),
            northStarGroups: num(row.north_star_groups),
        })),
    };
}

/** Progress toward 1000 MAU epic using PostHog-style MAU proxy (expense authors). */
export function mauEpicProgressPct(activeMau: number, target = MAU_EPIC_TARGET): number {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((activeMau / target) * 100));
}
