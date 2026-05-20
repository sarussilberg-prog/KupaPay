import type { CentBalance, CentTransfer } from './shared';

/**
 * Splitwise-style greedy matching for groups too large for exact search.
 *
 * Sort debtors and creditors by absolute balance descending, then keep
 * pairing the largest of each until everyone is square. For `k` non-zero
 * balances this produces at most `k - 1` transfers — not always optimal,
 * but fast (O(k log k)) and consistent with what other apps display.
 *
 * Input balances are assumed to sum to zero; the orchestrator validates
 * this before calling.
 */
export function simplifyDebtsGreedy(balances: CentBalance[]): CentTransfer[] {
    const debtors = balances
        .filter(b => b.cents < 0)
        .map(b => ({ ...b }))
        .sort((a, b) => a.cents - b.cents); // most negative first
    const creditors = balances
        .filter(b => b.cents > 0)
        .map(b => ({ ...b }))
        .sort((a, b) => b.cents - a.cents); // most positive first

    const transfers: CentTransfer[] = [];
    let di = 0;
    let ci = 0;
    while (di < debtors.length && ci < creditors.length) {
        const debtor = debtors[di];
        const creditor = creditors[ci];
        const amount = Math.min(-debtor.cents, creditor.cents);
        transfers.push({
            fromUserId: debtor.userId,
            toUserId: creditor.userId,
            cents: amount,
        });
        debtor.cents += amount;
        creditor.cents -= amount;
        if (debtor.cents === 0) di += 1;
        if (creditor.cents === 0) ci += 1;
    }
    return transfers;
}
