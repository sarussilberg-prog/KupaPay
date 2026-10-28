import { balanceSummaryRowsFromSummary } from '../../lib/balanceSummaryRows';

describe('balanceSummaryRowsFromSummary', () => {
    it('maps byCurrency and drops zero rows', () => {
        const rows = balanceSummaryRowsFromSummary({
            totalOwed: null,
            totalOwedToUser: null,
            defaultCurrency: 'USD',
            byCurrency: [
                { currency: 'USD', owed: 10, owedToUser: 0 },
                { currency: 'ILS', owed: 0, owedToUser: 0 },
                { currency: 'EUR', owed: 0, owedToUser: 5 },
            ],
        });
        expect(rows).toEqual([
            { currency: 'USD', owed: 0, owe: 10, net: -10 },
            { currency: 'EUR', owed: 5, owe: 0, net: 5 },
        ]);
    });
});
