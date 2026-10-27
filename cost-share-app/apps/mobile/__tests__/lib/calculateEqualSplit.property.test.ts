import * as fc from 'fast-check';
import { calculateEqualSplit, validateExpenseSplits } from '@cost-share/shared';

describe('calculateEqualSplit property invariants', () => {
    it('split amounts sum to the total within one cent for positive totals', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5_000_000 }),
                fc.integer({ min: 1, max: 20 }),
                (totalCents, numPeople) => {
                    const totalAmount = totalCents / 100;
                    const splits = calculateEqualSplit(totalAmount, numPeople);
                    expect(splits).toHaveLength(numPeople);
                    const rows = splits.map((amount, i) => ({
                        userId: `u${i}`,
                        amount,
                    }));
                    const check = validateExpenseSplits(totalAmount, rows);
                    expect(check.valid).toBe(true);
                },
            ),
            { numRuns: 200 },
        );
    });

    it('returns empty array for non-positive headcount', () => {
        expect(calculateEqualSplit(10, 0)).toEqual([]);
        expect(calculateEqualSplit(10, -1)).toEqual([]);
    });
});
