import {
    areSplitsEqual,
    autoFillUnlockedAmounts,
    buildUnequalSplits,
    computeUnequalTotal,
    inferUnequalModeFromSplits,
    parseSplitInput,
} from '../../lib/expenseSplitForm';

describe('expenseSplitForm', () => {
    it('detects equal splits', () => {
        expect(areSplitsEqual([10, 10, 10])).toBe(true);
        expect(areSplitsEqual([10, 10.01])).toBe(true);
        expect(areSplitsEqual([10, 12])).toBe(false);
    });

    it('validates percent totals', () => {
        const values = { u1: '50', u2: '50' };
        const result = computeUnequalTotal('percent', values, ['u1', 'u2'], 100);
        expect(result.isValid).toBe(true);
    });

    it('flags incomplete amount totals', () => {
        const values = { u1: '30', u2: '30' };
        const result = computeUnequalTotal('amount', values, ['u1', 'u2'], 100);
        expect(result.isValid).toBe(false);
        expect(result.difference).toBe(40);
    });

    it('adjusts amount-mode rounding remainder on the last split', () => {
        const splits = buildUnequalSplits(
            'amount',
            { u1: '33.33', u2: '33.33', u3: '33.33' },
            ['u1', 'u2', 'u3'],
            100,
        );
        const sum = splits.reduce((acc, s) => acc + (s.amount ?? 0), 0);
        expect(sum).toBeCloseTo(100, 2);
    });

    it('builds splits from percent inputs', () => {
        const splits = buildUnequalSplits(
            'percent',
            { u1: '60', u2: '40' },
            ['u1', 'u2'],
            100,
        );
        expect(splits).toHaveLength(2);
        const sum = splits.reduce((acc, s) => acc + (s.amount ?? 0), 0);
        expect(sum).toBeCloseTo(100, 2);
    });

    it('infers percent mode from splits', () => {
        const inferred = inferUnequalModeFromSplits(
            [
                { userId: 'u1', amount: 60 },
                { userId: 'u2', amount: 40 },
            ],
            100,
        );
        expect(inferred.mode).toBe('percent');
        expect(parseSplitInput(inferred.values.u1)).toBe(60);
    });

    describe('autoFillUnlockedAmounts', () => {
        const lock = (ids: string[]) => new Set(ids);

        it('seeds an equal split when nothing is locked', () => {
            expect(autoFillUnlockedAmounts(100, ['a', 'b', 'c'], {}, lock([]))).toEqual({
                a: '33.33',
                b: '33.33',
                c: '33.34',
            });
        });

        it('fills the remainder among the others when one member is edited', () => {
            // User typed a=60 → b,c auto-fill to 20 each (the "60 - 20 - 20" step).
            expect(
                autoFillUnlockedAmounts(100, ['a', 'b', 'c'], { a: '60' }, lock(['a'])),
            ).toEqual({ a: '60', b: '20.00', c: '20.00' });
        });

        it('cascades: a second edit re-fills only the still-unlocked member', () => {
            // a=60, b=30 locked → c auto-fills to 10 (the "60 - 30 - 10" step).
            expect(
                autoFillUnlockedAmounts(100, ['a', 'b', 'c'], { a: '60', b: '30' }, lock(['a', 'b'])),
            ).toEqual({ a: '60', b: '30', c: '10.00' });
        });

        it('puts the rounding penny on the last unlocked member', () => {
            expect(autoFillUnlockedAmounts(10, ['a', 'b', 'c'], {}, lock([]))).toEqual({
                a: '3.33',
                b: '3.33',
                c: '3.34',
            });
        });

        it('clamps unlocked members to 0 when locked values already exceed the total', () => {
            expect(
                autoFillUnlockedAmounts(100, ['a', 'b', 'c'], { a: '120' }, lock(['a'])),
            ).toEqual({ a: '120', b: '0.00', c: '0.00' });
        });

        it('returns the values unchanged when every member is locked', () => {
            const values = { a: '60', b: '30', c: '50' };
            expect(autoFillUnlockedAmounts(100, ['a', 'b', 'c'], values, lock(['a', 'b', 'c']))).toBe(
                values,
            );
        });

        it('only distributes among selected members', () => {
            // remainder splits between a (locked 70) and b.
            expect(
                autoFillUnlockedAmounts(100, ['a', 'b'], { a: '70' }, lock(['a'])),
            ).toEqual({ a: '70', b: '30.00' });
        });
    });
});
