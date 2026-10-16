import React from 'react';
import { renderWithQuery } from '../helpers/renderWithQuery';
import { TripBudgetSection } from '../../components/budget/TripBudgetSection';

jest.mock('../../services/tripBudget.service', () => ({
    fetchGroupTripBudget: jest.fn().mockResolvedValue({ amount: 100, currency: 'USD' }),
}));

describe('TripBudgetSection', () => {
    it('shows locked upsell when Pro perk is locked', () => {
        const { getByText } = renderWithQuery(
            <TripBudgetSection
                groupId="g1"
                defaultCurrency="USD"
                expenses={[]}
                unlocked={false}
                onUpgrade={jest.fn()}
            />,
        );
        expect(getByText('pro.tripBudget.title')).toBeTruthy();
    });

    it('shows edit control when unlocked after budget loads', async () => {
        const { findByText } = renderWithQuery(
            <TripBudgetSection
                groupId="g1"
                defaultCurrency="USD"
                expenses={[]}
                unlocked
                onUpgrade={jest.fn()}
            />,
        );
        expect(await findByText('pro.tripBudget.edit')).toBeTruthy();
    });
});
