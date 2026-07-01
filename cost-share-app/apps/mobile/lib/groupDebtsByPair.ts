/**
 * groupDebtsByPair — display-only grouping of open debts by the unordered pair
 * of people they involve. Used by the Settle Up screen to collapse the 2+
 * debts between the same two members (e.g. multiple currencies, or debts that
 * happen to flow both ways) into a single expandable row. The underlying
 * simplification algorithm and data are untouched — this is pure presentation.
 */

export interface PairGroupDebt {
    fromUserId: string;
    toUserId: string;
    amount: number;
}

export interface PairGroup<T extends PairGroupDebt> {
    /** Stable key for the unordered {A, B} pair. */
    pairKey: string;
    /** The two distinct user ids in the pair (insertion order of first debt). */
    userA: string;
    userB: string;
    /** The debts between this pair, preserving their incoming order. */
    debts: T[];
    /** True when debts flow in both directions between the pair. */
    bidirectional: boolean;
    /** When !bidirectional, the shared debtor → creditor of every debt. */
    fromUserId: string;
    toUserId: string;
}

function pairKeyOf(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function maxAmount<T extends PairGroupDebt>(debts: T[]): number {
    return debts.reduce((max, d) => (d.amount > max ? d.amount : max), -Infinity);
}

/**
 * Group debts by the unordered pair of users involved. Groups are sorted by
 * their largest single debt (descending) so the ordering matches the existing
 * amount-sorted lists. A pair with a single debt still yields a one-element
 * group — the caller renders those as a plain row, no collapsing.
 */
export function groupDebtsByPair<T extends PairGroupDebt>(debts: T[]): PairGroup<T>[] {
    const byKey = new Map<string, T[]>();
    const order: string[] = [];
    for (const d of debts) {
        const key = pairKeyOf(d.fromUserId, d.toUserId);
        const existing = byKey.get(key);
        if (existing) {
            existing.push(d);
        } else {
            byKey.set(key, [d]);
            order.push(key);
        }
    }

    const groups = order.map<PairGroup<T>>(key => {
        const list = byKey.get(key)!;
        const first = list[0];
        const directions = new Set(list.map(d => `${d.fromUserId}>${d.toUserId}`));
        return {
            pairKey: key,
            userA: first.fromUserId,
            userB: first.toUserId,
            debts: list,
            bidirectional: directions.size > 1,
            fromUserId: first.fromUserId,
            toUserId: first.toUserId,
        };
    });

    groups.sort((a, b) => maxAmount(b.debts) - maxAmount(a.debts));
    return groups;
}
