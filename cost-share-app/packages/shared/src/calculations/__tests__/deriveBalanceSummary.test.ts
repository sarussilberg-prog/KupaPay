import type { SimplifiedDebts } from '../../types';
import { deriveBalanceSummary } from '../simplifiedDebtsModel';

function emptySimplified(userTransfers: SimplifiedDebts['userTransfers']): SimplifiedDebts {
    return {
        transfers: userTransfers,
        byGroupCurrency: new Map(),
        userTransfers,
        groupRollups: new Map(),
        friendBalances: new Map(),
        unbalanced: [],
    };
}

describe('deriveBalanceSummary', () => {
    const me = 'user_me';

    it('aggregates owed vs owedToUser per currency from userTransfers', () => {
        const summary = deriveBalanceSummary(
            emptySimplified([
                {
                    groupId: 'g1',
                    currency: 'USD',
                    fromUserId: me,
                    toUserId: 'bob',
                    amount: 10,
                },
                {
                    groupId: 'g1',
                    currency: 'USD',
                    fromUserId: 'carol',
                    toUserId: me,
                    amount: 25,
                },
                {
                    groupId: 'g2',
                    currency: 'EUR',
                    fromUserId: me,
                    toUserId: 'dave',
                    amount: 5,
                },
            ]),
            me,
            'USD',
        );

        expect(summary.totalOwed).toBeNull();
        expect(summary.totalOwedToUser).toBeNull();
        expect(summary.defaultCurrency).toBe('USD');
        expect(summary.byCurrency).toEqual([
            { currency: 'EUR', owed: 5, owedToUser: 0 },
            { currency: 'USD', owed: 10, owedToUser: 25 },
        ]);
    });

    it('drops currency rows that round to zero on both sides', () => {
        const summary = deriveBalanceSummary(
            emptySimplified([
                {
                    groupId: 'g1',
                    currency: 'USD',
                    fromUserId: me,
                    toUserId: 'bob',
                    amount: 0.004,
                },
            ]),
            me,
            'USD',
        );
        expect(summary.byCurrency).toEqual([]);
    });

    it('returns empty byCurrency when user has no transfers', () => {
        const summary = deriveBalanceSummary(emptySimplified([]), me, 'ILS');
        expect(summary.byCurrency).toEqual([]);
        expect(summary.defaultCurrency).toBe('ILS');
    });
});
