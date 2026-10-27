import type { BalanceSummary } from '../types';

export type GroupsListForeignBalanceHint = {
    /** Foreign currencies with a non-zero net (excluding default). */
    count: number;
    net: number;
    currency: string;
};

export type GroupsListSummaryParts = {
    primaryNet: number | null;
    primaryCurrency: string;
    foreignHint?: GroupsListForeignBalanceHint;
};

function round2(n: number): number {
    return Number(n.toFixed(2));
}

function currencyRowNet(owed: number, owedToUser: number): number {
    return round2(owedToUser - owed);
}

/**
 * Headline + secondary-currency hint for the groups list summary card (mockup B2).
 * `primaryNet` mirrors profile headline math: owedToUser − owed in default currency.
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

    const foreignRows = summary.byCurrency
        .filter(row => row.currency !== primaryCurrency)
        .map(row => ({
            currency: row.currency,
            net: currencyRowNet(row.owed, row.owedToUser),
        }))
        .filter(row => Math.abs(row.net) >= 0.01);

    if (foreignRows.length === 0) {
        return { primaryNet, primaryCurrency };
    }

    const highlight = [...foreignRows].sort(
        (a, b) => Math.abs(b.net) - Math.abs(a.net),
    )[0];

    return {
        primaryNet,
        primaryCurrency,
        foreignHint: {
            count: foreignRows.length,
            net: highlight.net,
            currency: highlight.currency,
        },
    };
}
