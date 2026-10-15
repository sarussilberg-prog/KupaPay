import { convertDebtsToTripCurrency } from '../../lib/tripCurrencyConversion';

describe('convertDebtsToTripCurrency', () => {
    it('converts using rates from target currency base', () => {
        const rows = convertDebtsToTripCurrency(
            [{ fromUserId: 'a', toUserId: 'b', currency: 'USD', amount: 10 }],
            'ILS',
            { USD: 0.27 },
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]!.convertedAmount).toBeGreaterThan(10);
        expect(rows[0]!.targetCurrency).toBe('ILS');
    });
});
