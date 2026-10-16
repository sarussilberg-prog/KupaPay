import { buildInviteUrl } from '../../invites/urls';
import {
    calculateEqualSplit,
    calculateUserBalancesFromData,
    validateExpenseSplits,
} from '../index';

describe('money matrix — splits and rounding', () => {
    it('calculateEqualSplit assigns remainder to last member (33.33 × 3)', () => {
        expect(calculateEqualSplit(100, 3)).toEqual([33.33, 33.33, 33.34]);
    });

    it('validateExpenseSplits rejects sum drift over 1 cent', () => {
        const result = validateExpenseSplits(10, [
            { userId: 'a', amount: 5 },
            { userId: 'b', amount: 4.98 },
        ]);
        expect(result.valid).toBe(false);
        expect(result.difference).toBe(0.02);
    });

    it('validateExpenseSplits accepts balanced splits', () => {
        expect(
            validateExpenseSplits(100, [
                { userId: 'a', amount: 33.33 },
                { userId: 'b', amount: 33.33 },
                { userId: 'c', amount: 33.34 },
            ]).valid,
        ).toBe(true);
    });

    it('validateExpenseSplits rejects negative amounts', () => {
        expect(
            validateExpenseSplits(10, [{ userId: 'a', amount: -1 }]).valid,
        ).toBe(false);
    });
});

describe('money matrix — settlements and balances', () => {
    const groupId = 'g1';
    const users = ['alice', 'bob', 'charlie'];

    it('net balance reflects paid, owed, and settlements', () => {
        const balances = calculateUserBalancesFromData(
            groupId,
            'USD',
            users,
            [{ id: 'e1', paidBy: 'alice', amount: 90 }],
            [
                { expenseId: 'e1', userId: 'alice', amount: 30 },
                { expenseId: 'e1', userId: 'bob', amount: 30 },
                { expenseId: 'e1', userId: 'charlie', amount: 30 },
            ],
            [{ fromUserId: 'bob', toUserId: 'alice', amount: 30 }],
        );

        const byUser = Object.fromEntries(balances.map((b) => [b.userId, b]));
        expect(byUser.alice.netBalance).toBe(30);
        expect(byUser.bob.netBalance).toBe(0);
        expect(byUser.charlie.netBalance).toBe(-30);
    });

    it('guest-style uneven split still balances to zero sum', () => {
        const balances = calculateUserBalancesFromData(
            groupId,
            'ILS',
            ['host', 'guest'],
            [{ id: 'e1', paidBy: 'host', amount: 100 }],
            [
                { expenseId: 'e1', userId: 'host', amount: 40 },
                { expenseId: 'e1', userId: 'guest', amount: 60 },
            ],
            [],
        );
        const sum = balances.reduce((s, b) => s + b.netBalance, 0);
        expect(Number(sum.toFixed(2))).toBe(0);
    });
});

describe('money matrix — referral invite URL shape', () => {
    it('friend invite URLs use /i/ prefix', () => {
        expect(buildInviteUrl('friend', 'abc123')).toMatch(/\/i\/abc123$/);
    });
});
