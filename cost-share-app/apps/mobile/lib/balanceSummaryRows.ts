import type { BalanceSummary, BalanceSummaryRow } from '@cost-share/shared';

/** Map profile balance `byCurrency` rows to summary header rows (spec groups list). */
export function balanceSummaryRowsFromSummary(
    summary: BalanceSummary | undefined,
): BalanceSummaryRow[] {
    if (!summary?.byCurrency?.length) return [];
    return summary.byCurrency
        .map(row => ({
            currency: row.currency,
            owed: row.owedToUser,
            owe: row.owed,
            net: row.owedToUser - row.owed,
        }))
        .filter(r => r.owed >= 0.01 || r.owe >= 0.01);
}
