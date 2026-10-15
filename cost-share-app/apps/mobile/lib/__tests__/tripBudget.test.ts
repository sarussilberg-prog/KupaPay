import { sumExpensesInCurrency, tripBudgetPercent } from '../tripBudget';

describe('tripBudget', () => {
    it('computes percent capped', () => {
        expect(tripBudgetPercent(80, 100)).toBe(80);
        expect(tripBudgetPercent(150, 100)).toBe(150);
    });

    it('sums matching currency only', () => {
        const total = sumExpensesInCurrency(
            [
                { amount: 10, currency: 'USD' },
                { amount: 5, currency: 'EUR' },
                { amount: 3, currency: 'usd', isDeleted: true },
            ],
            'USD',
        );
        expect(total).toBe(10);
    });
});
