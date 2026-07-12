import { PairwiseDebt } from '@cost-share/shared';

/**
 * All debts the given debtor owes the given creditor, sorted by currency code
 * for a stable order. Both ends must match, so opposite-direction debts and
 * debts to other people are excluded.
 */
export function owedDebts(
    debts: PairwiseDebt[],
    fromUserId: string,
    toUserId: string,
): PairwiseDebt[] {
    return debts
        .filter(d => d.fromUserId === fromUserId && d.toUserId === toUserId)
        .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Renders a list of debts as a localized amount string, e.g.
 * "USD 24.00 and ILS 45.00". `andWord` is the localized conjunction inserted
 * before the final amount (EN " and ", HE " ו-"); earlier amounts are
 * comma-separated.
 */
export function joinAmounts(debts: PairwiseDebt[], andWord: string): string {
    const parts = debts.map(d => `${d.currency} ${d.amount.toFixed(2)}`);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + andWord + parts[parts.length - 1];
}
