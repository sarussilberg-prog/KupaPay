import {
    simplifyDebtsGreedy,
} from '@cost-share/shared/calculations/simplifyDebts/greedy';
import type { CentBalance } from '@cost-share/shared/calculations/simplifyDebts/shared';

/**
 * Helper: assert applying all transfers zeroes every balance.
 * Operates on integer cents to avoid floating-point noise.
 */
function assertBalancesZeroed(
    balances: CentBalance[],
    transfers: { fromUserId: string; toUserId: string; cents: number }[],
): void {
    const net = new Map<string, number>();
    for (const b of balances) net.set(b.userId, b.cents);
    for (const t of transfers) {
        net.set(t.fromUserId, (net.get(t.fromUserId) ?? 0) + t.cents);
        net.set(t.toUserId, (net.get(t.toUserId) ?? 0) - t.cents);
    }
    for (const [userId, cents] of net) {
        expect({ userId, cents }).toEqual({ userId, cents: 0 });
    }
}

describe('simplifyDebtsGreedy', () => {
    it('returns no transfers when all balances are zero', () => {
        expect(simplifyDebtsGreedy([])).toEqual([]);
    });

    it('handles two-person debt', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: 5000 },
        ];
        const transfers = simplifyDebtsGreedy(balances);
        expect(transfers).toEqual([
            { fromUserId: 'A', toUserId: 'B', cents: 5000 },
        ]);
        assertBalancesZeroed(balances, transfers);
    });

    it('matches largest debtor with largest creditor first', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: 2000 },
            { userId: 'C', cents: 1500 },
            { userId: 'D', cents: 1000 },
            { userId: 'E', cents: 500 },
        ];
        const transfers = simplifyDebtsGreedy(balances);
        // A is the only debtor; first match must go to the largest creditor (B).
        expect(transfers[0]).toEqual({ fromUserId: 'A', toUserId: 'B', cents: 2000 });
        expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
        assertBalancesZeroed(balances, transfers);
    });

    it('produces at most k-1 transfers for k non-zero members', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -3000 },
            { userId: 'B', cents: -2000 },
            { userId: 'C', cents: 1500 },
            { userId: 'D', cents: 1500 },
            { userId: 'E', cents: 2000 },
        ];
        const transfers = simplifyDebtsGreedy(balances);
        expect(transfers.length).toBeLessThanOrEqual(4);
        assertBalancesZeroed(balances, transfers);
    });
});
