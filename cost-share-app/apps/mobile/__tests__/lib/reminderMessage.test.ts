import { PairwiseDebt } from '@cost-share/shared';
import { owedDebts, joinAmounts } from '../../lib/reminderMessage';

const debt = (
    fromUserId: string,
    toUserId: string,
    currency: string,
    amount: number,
): PairwiseDebt => ({ fromUserId, toUserId, currency, amount });

describe('owedDebts', () => {
    it('returns only debts the debtor owes the creditor, sorted by currency', () => {
        const debts = [
            debt('B', 'A', 'ILS', 21152.7),
            debt('B', 'C', 'USD', 5), // different creditor — excluded
            debt('A', 'B', 'EUR', 9), // opposite direction — excluded
            debt('B', 'A', 'ALL', 340),
        ];

        expect(owedDebts(debts, 'B', 'A')).toEqual([
            debt('B', 'A', 'ALL', 340),
            debt('B', 'A', 'ILS', 21152.7),
        ]);
    });

    it('returns an empty array when nothing matches', () => {
        expect(owedDebts([debt('B', 'C', 'USD', 5)], 'B', 'A')).toEqual([]);
    });
});

describe('joinAmounts', () => {
    it('formats a single debt as CUR 0.00', () => {
        expect(joinAmounts([debt('B', 'A', 'ILS', 2179.4)], ' and ')).toBe('ILS 2179.40');
    });

    it('joins two debts with the and-word', () => {
        const parts = [debt('B', 'A', 'USD', 24), debt('B', 'A', 'ILS', 45)];
        expect(joinAmounts(parts, ' and ')).toBe('USD 24.00 and ILS 45.00');
    });

    it('joins three debts with commas and a final and-word', () => {
        const parts = [
            debt('B', 'A', 'USD', 24),
            debt('B', 'A', 'ILS', 45),
            debt('B', 'A', 'EUR', 10),
        ];
        expect(joinAmounts(parts, ' and ')).toBe('USD 24.00, ILS 45.00 and EUR 10.00');
    });

    it('uses the localized and-word for Hebrew', () => {
        const parts = [debt('B', 'A', 'USD', 24), debt('B', 'A', 'ILS', 45)];
        expect(joinAmounts(parts, ' ו-')).toBe('USD 24.00 ו-ILS 45.00');
    });

    it('returns an empty string for no debts', () => {
        expect(joinAmounts([], ' and ')).toBe('');
    });
});
