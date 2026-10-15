import {
    aggregateSpendingByCategory,
    aggregateSpendingByMember,
    aggregateSpendingOverTime,
} from '../spendingInsights';

const sample = [
    { amount: 100, currency: 'USD', category: 'food', expenseDate: '2026-06-01', paidBy: 'a' },
    { amount: 50, currency: 'USD', category: 'food', expenseDate: '2026-06-03', paidBy: 'b' },
    { amount: 20, currency: 'EUR', category: 'transport', expenseDate: '2026-06-04', paidBy: 'a' },
];

describe('spendingInsights', () => {
    it('aggregates by category in default currency', () => {
        const rows = aggregateSpendingByCategory(sample, 'USD');
        expect(rows).toEqual([{ key: 'food', total: 150, currency: 'USD' }]);
    });

    it('aggregates by member paid totals', () => {
        const rows = aggregateSpendingByMember(sample, 'USD');
        expect(rows.find(r => r.key === 'a')?.total).toBe(100);
        expect(rows.find(r => r.key === 'b')?.total).toBe(50);
    });

    it('aggregates weekly buckets', () => {
        const rows = aggregateSpendingOverTime(sample, 'USD');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.reduce((s, r) => s + r.total, 0)).toBe(150);
    });
});
