import {
    MAU_EPIC_TARGET,
    mauEpicProgressPct,
    parseGrowthMetricsRpc,
} from '../growthMetrics';

describe('parseGrowthMetricsRpc', () => {
    it('maps snake_case RPC JSONB to AdminGrowthMetrics', () => {
        const parsed = parseGrowthMetricsRpc({
            as_of: '2026-10-27T08:00:00Z',
            north_star: {
                definition: 'monthly_active_groups_with_two_plus_expense_authors',
                current_month: '2026-10',
                current_month_count: 12,
                previous_month: '2026-09',
                previous_month_count: 9,
            },
            active_expense_authors: { dau: 3, wau: 20, mau: 88, note: 'complement PostHog' },
            north_star_monthly_series: [{ month: '2026-10', north_star_groups: 12 }],
        });
        expect(parsed.northStar.currentMonthCount).toBe(12);
        expect(parsed.activeExpenseAuthors.mau).toBe(88);
        expect(parsed.northStarMonthlySeries[0].northStarGroups).toBe(12);
    });

    it('coerces missing fields to safe defaults', () => {
        const parsed = parseGrowthMetricsRpc({});
        expect(parsed.northStar.currentMonthCount).toBe(0);
        expect(parsed.activeExpenseAuthors.mau).toBe(0);
        expect(parsed.northStarMonthlySeries).toEqual([]);
    });
});

describe('mauEpicProgressPct', () => {
    it('caps at 100% of epic target', () => {
        expect(mauEpicProgressPct(500, MAU_EPIC_TARGET)).toBe(50);
        expect(mauEpicProgressPct(2000, MAU_EPIC_TARGET)).toBe(100);
    });
});
