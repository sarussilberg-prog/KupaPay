import {
    buildFriendCrossGroupSettlePreview,
    computeFriendCrossGroupCurrencyLines,
    computeFriendCrossGroupNet,
    friendPairTransfers,
    shouldShowPaidInCurrencyNote,
} from '../friendCrossGroupSettle';
import type { SimplifiedDebts, Transfer } from '../../types';

function emptySimplified(transfers: Transfer[]): SimplifiedDebts {
    return {
        transfers,
        byGroupCurrency: new Map(),
        userTransfers: transfers,
        groupRollups: new Map(),
        friendBalances: new Map(),
        unbalanced: [],
    };
}

describe('friendCrossGroupSettle', () => {
    const me = 'u-me';
    const friend = 'u-friend';
    const rates = { USD: 0.27, EUR: 0.24 };

    it('friendPairTransfers keeps only pair edges', () => {
        const transfers: Transfer[] = [
            { groupId: 'g1', currency: 'ILS', fromUserId: me, toUserId: friend, amount: 50 },
            { groupId: 'g1', currency: 'USD', fromUserId: friend, toUserId: me, amount: 10 },
            { groupId: 'g2', currency: 'ILS', fromUserId: me, toUserId: 'other', amount: 5 },
        ];
        const simplified = emptySimplified(transfers);
        expect(friendPairTransfers(simplified, me, friend)).toHaveLength(2);
    });

    it('computeFriendCrossGroupCurrencyLines nets per currency', () => {
        const transfers: Transfer[] = [
            { groupId: 'g1', currency: 'ILS', fromUserId: friend, toUserId: me, amount: 100 },
            { groupId: 'g2', currency: 'ILS', fromUserId: me, toUserId: friend, amount: 40 },
            { groupId: 'g1', currency: 'USD', fromUserId: friend, toUserId: me, amount: 27 },
        ];
        const lines = computeFriendCrossGroupCurrencyLines(transfers, me, friend);
        expect(lines).toEqual([
            { currency: 'ILS', netAmount: 60 },
            { currency: 'USD', netAmount: 27 },
        ]);
    });

    it('computeFriendCrossGroupNet FX-weights into default currency', () => {
        const transfers: Transfer[] = [
            { groupId: 'g1', currency: 'ILS', fromUserId: friend, toUserId: me, amount: 100 },
            { groupId: 'g2', currency: 'USD', fromUserId: me, toUserId: friend, amount: 27 },
        ];
        const simplified = emptySimplified(transfers);
        const result = computeFriendCrossGroupNet(simplified, me, friend, 'ILS', rates);
        expect(result.perCurrency).toHaveLength(2);
        expect(result.weightedInDefault).toEqual({
            netBalance: 0,
            currency: 'ILS',
            isConverted: true,
        });
    });

    it('buildFriendCrossGroupSettlePreview emits per-group plans', () => {
        const transfers: Transfer[] = [
            { groupId: 'g1', currency: 'ILS', fromUserId: friend, toUserId: me, amount: 50 },
            { groupId: 'g2', currency: 'ILS', fromUserId: me, toUserId: friend, amount: 20 },
        ];
        const simplified = emptySimplified(transfers);
        const preview = buildFriendCrossGroupSettlePreview(
            simplified,
            me,
            friend,
            ['g1', 'g2'],
            'ILS',
            'ILS',
            rates,
        );
        expect(preview.conversionFailed).toBe(false);
        expect(preview.groupPlans).toHaveLength(2);
        expect(preview.netPayerId).toBe(friend);
        expect(preview.netAmountInTarget).toBe(30);
    });

    it('shouldShowPaidInCurrencyNote when payment currency differs', () => {
        expect(shouldShowPaidInCurrencyNote('USD', ['ILS'])).toBe(true);
        expect(shouldShowPaidInCurrencyNote('ILS', ['ILS'])).toBe(false);
        expect(shouldShowPaidInCurrencyNote('USD', ['ILS', 'EUR'])).toBe(true);
    });
});
