import { groupDebtsByPair } from '../../lib/groupDebtsByPair';

const debt = (fromUserId: string, toUserId: string, amount: number, currency = 'USD') => ({
    fromUserId,
    toUserId,
    currency,
    amount,
});

describe('groupDebtsByPair', () => {
    it('keeps a single-debt pair as a one-element, one-directional group', () => {
        const groups = groupDebtsByPair([debt('a', 'b', 30)]);
        expect(groups).toHaveLength(1);
        expect(groups[0].debts).toHaveLength(1);
        expect(groups[0].bidirectional).toBe(false);
        expect(groups[0].fromUserId).toBe('a');
        expect(groups[0].toUserId).toBe('b');
    });

    it('collapses multiple same-direction debts (e.g. currencies) into one group', () => {
        const groups = groupDebtsByPair([
            debt('a', 'b', 40, 'USD'),
            debt('a', 'b', 12, 'EUR'),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].debts).toHaveLength(2);
        expect(groups[0].bidirectional).toBe(false);
        expect(groups[0].fromUserId).toBe('a');
        expect(groups[0].toUserId).toBe('b');
    });

    it('marks a group bidirectional when debts flow both ways between the pair', () => {
        const groups = groupDebtsByPair([
            debt('a', 'b', 40, 'USD'),
            debt('b', 'a', 12, 'EUR'),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].bidirectional).toBe(true);
        expect(new Set([groups[0].userA, groups[0].userB])).toEqual(new Set(['a', 'b']));
    });

    it('groups distinct pairs separately and orders them by largest debt desc', () => {
        const groups = groupDebtsByPair([
            debt('a', 'b', 5),
            debt('c', 'd', 100),
            debt('a', 'b', 50),
        ]);
        expect(groups).toHaveLength(2);
        // c→d (max 100) comes before a→b (max 50)
        expect(groups[0].pairKey).toBe('c|d');
        expect(groups[1].pairKey).toBe('a|b');
        expect(groups[1].debts).toHaveLength(2);
    });

    it('uses an order-independent key so a↔b and b↔a land in the same group', () => {
        const groups = groupDebtsByPair([debt('b', 'a', 10), debt('a', 'b', 20)]);
        expect(groups).toHaveLength(1);
        expect(groups[0].pairKey).toBe('a|b');
    });
});
