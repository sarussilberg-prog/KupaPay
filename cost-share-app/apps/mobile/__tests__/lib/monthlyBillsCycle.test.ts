import { monthlyCycleBounds } from '@cost-share/shared';

describe('monthlyBillsCycle', () => {
    it('returns bounded cycle dates', () => {
        const { start, end } = monthlyCycleBounds(new Date('2026-05-20T00:00:00Z'), 5);
        expect(end.getTime()).toBeGreaterThan(start.getTime());
    });
});
