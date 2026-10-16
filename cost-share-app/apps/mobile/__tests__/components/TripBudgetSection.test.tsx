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

    it('shows progress when unlocked and budget is set', async () => {
        const { findByText } = renderWithQuery(
            <TripBudgetSection
                groupId="g1"
                defaultCurrency="USD"
                expenses={[
                    {
                        id: 'e1',
                        groupId: 'g1',
                        amount: 50,
                        currency: 'USD',
                        isDeleted: false,
                    } as never,
                ]}
                unlocked
                onUpgrade={jest.fn()}
            />,
        );
        expect(await findByText(/50\.00/)).toBeTruthy();
    });
});
