import { expenseInMonthlyCycle, monthlyCycleBounds } from '../monthlyBillsCycle';

describe('monthlyBillsCycle', () => {
    it('computes cycle bounds for mid-month reference', () => {
        const ref = new Date('2026-03-15T12:00:00Z');
        const { start, end } = monthlyCycleBounds(ref, 1);
        expect(start.toISOString().slice(0, 10)).toBe('2026-03-01');
        expect(end.toISOString().slice(0, 10)).toBe('2026-04-01');
    });

    it('filters expense dates inside cycle', () => {
        expect(expenseInMonthlyCycle('2026-03-10', 1, new Date('2026-03-15T00:00:00Z'))).toBe(true);
        expect(expenseInMonthlyCycle('2026-02-28', 1, new Date('2026-03-15T00:00:00Z'))).toBe(false);
    });
});
