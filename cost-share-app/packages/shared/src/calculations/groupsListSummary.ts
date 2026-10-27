import type { BalanceSummary } from '../types';

export type GroupsListSummaryParts = {
    primaryNet: number | null;
    primaryCurrency: string;
    /** Non-default currencies with a non-zero net in `byCurrency` (for FX-failure hint only). */
    foreignCurrencyCount: number;
};

function round2(n: number): number {
    return Number(n.toFixed(2));
}

function currencyRowNet(owed: number, owedToUser: number): number {
    return round2(owedToUser - owed);
}

/**
 * Headline totals for the groups list summary card (mockup B2).
 * `primaryNet` mirrors profile headline math: owedToUser − owed in `defaultCurrency`
 * after FX aggregation (see `deriveProfileBalanceSummary`).
 */
export function deriveGroupsListSummaryParts(
    summary: BalanceSummary | undefined,
): GroupsListSummaryParts | undefined {
    if (!summary) return undefined;

    const primaryCurrency = summary.defaultCurrency;
    let primaryNet: number | null = null;
    if (summary.totalOwed !== null && summary.totalOwedToUser !== null) {
        primaryNet = round2(summary.totalOwedToUser - summary.totalOwed);
    }

    const foreignCurrencyCount = summary.byCurrency.filter(row => {
        if (row.currency === primaryCurrency) return false;
        const net = currencyRowNet(row.owed, row.owedToUser);
        return Math.abs(net) >= 0.01;
    }).length;

    return { primaryNet, primaryCurrency, foreignCurrencyCount };
}
