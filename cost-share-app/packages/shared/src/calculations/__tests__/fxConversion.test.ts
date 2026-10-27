import {
    aggregateBalanceInBaseCurrency,
    aggregateBalanceWithoutFx,
    convertToBaseCurrency,
} from '../fxConversion';

describe('convertToBaseCurrency', () => {
    const rates = { USD: 1, EUR: 0.92, ILS: 3.7 };

    it('returns 0 for dust amounts', () => {
        expect(convertToBaseCurrency(0.001, 'EUR', 'USD', rates)).toBe(0);
    });

    it('passes through base currency unchanged', () => {
        expect(convertToBaseCurrency(10, 'USD', 'USD', rates)).toBe(10);
    });

    it('converts using rates from base and rounds to cents', () => {
        expect(convertToBaseCurrency(92, 'EUR', 'USD', rates)).toBe(100);
    });

    it('returns null when rate is missing or invalid', () => {
        expect(convertToBaseCurrency(10, 'GBP', 'USD', rates)).toBeNull();
        expect(convertToBaseCurrency(10, 'EUR', 'USD', { EUR: 0 })).toBeNull();
    });
});

describe('aggregateBalanceWithoutFx', () => {
    it('sums base-currency rows only', () => {
        expect(
            aggregateBalanceWithoutFx(
                [
                    { currency: 'USD', owed: 10.005, owedToUser: 0 },
                    { currency: 'USD', owed: 0, owedToUser: 4.444 },
                ],
                'USD',
            ),
        ).toEqual({ totalOwed: 10.01, totalOwedToUser: 4.44 });
    });

    it('returns null when a foreign currency has balance', () => {
        expect(
            aggregateBalanceWithoutFx([{ currency: 'EUR', owed: 1, owedToUser: 0 }], 'USD'),
        ).toBeNull();
    });
});

describe('aggregateBalanceInBaseCurrency', () => {
    const rates = { USD: 1, EUR: 0.5 };

    it('aggregates multi-currency rows into base', () => {
        expect(
            aggregateBalanceInBaseCurrency(
                [
                    { currency: 'USD', owed: 10, owedToUser: 0 },
                    { currency: 'EUR', owed: 5, owedToUser: 0 },
                ],
                'USD',
                rates,
            ),
        ).toEqual({ totalOwed: 20, totalOwedToUser: 0 });
    });

    it('returns null when any row cannot convert', () => {
        expect(
            aggregateBalanceInBaseCurrency(
                [{ currency: 'GBP', owed: 1, owedToUser: 0 }],
                'USD',
                rates,
            ),
        ).toBeNull();
    });
});
