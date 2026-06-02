import { collectProfileFxCurrencies } from '../../lib/collectProfileFxCurrencies';

describe('collectProfileFxCurrencies', () => {
    it('merges foreign currencies from balance summary and friends', () => {
        expect(
            collectProfileFxCurrencies(
                {
                    totalOwed: null,
                    totalOwedToUser: null,
                    defaultCurrency: 'ILS',
                    byCurrency: [{ currency: 'USD', owed: 0, owedToUser: 10 }],
                },
                [
                    {
                        userId: 'u2',
                        name: 'Bob',
                        isActive: true,
                        sharedGroupIds: ['g1'],
                        byCurrency: [
                            { currency: 'EUR', netBalance: 5 },
                            { currency: 'ILS', netBalance: 1 },
                        ],
                    },
                ],
                'ILS',
            ),
        ).toEqual(['EUR', 'USD']);
    });
});
