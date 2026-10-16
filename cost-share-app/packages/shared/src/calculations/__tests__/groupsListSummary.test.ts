import { deriveGroupsListSummaryParts } from '../groupsListSummary';
import type { BalanceSummary } from '../../types';

function makeSummary(
    partial: Partial<BalanceSummary> & Pick<BalanceSummary, 'defaultCurrency'>,
): BalanceSummary {
    return {
        totalOwed: null,
        totalOwedToUser: null,
        byCurrency: [],
        ...partial,
    };
}

describe('deriveGroupsListSummaryParts', () => {
    it('returns undefined when summary is missing', () => {
        expect(deriveGroupsListSummaryParts(undefined)).toBeUndefined();
    });

    it('derives primary net from headline totals', () => {
        const parts = deriveGroupsListSummaryParts(
            makeSummary({
                defaultCurrency: 'USD',
                totalOwed: 20,
                totalOwedToUser: 50,
                byCurrency: [{ currency: 'USD', owed: 20, owedToUser: 50 }],
            }),
        );
        expect(parts?.primaryNet).toBe(30);
        expect(parts?.primaryCurrency).toBe('USD');
        expect(parts?.foreignHint).toBeUndefined();
    });

    it('adds a foreign hint for non-default currencies', () => {
        const parts = deriveGroupsListSummaryParts(
            makeSummary({
                defaultCurrency: 'USD',
                totalOwed: 10,
                totalOwedToUser: 10,
                byCurrency: [
                    { currency: 'USD', owed: 10, owedToUser: 10 },
                    { currency: 'AFN', owed: 0, owedToUser: 138.75 },
                ],
            }),
        );
        expect(parts?.foreignHint).toEqual({
            count: 1,
            net: 138.75,
            currency: 'AFN',
        });
    });
});
