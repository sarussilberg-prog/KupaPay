import React from 'react';
import { renderWithQuery } from '../helpers/renderWithQuery';
import { SpendingInsightsSheet } from '../../components/insights/SpendingInsightsSheet';

jest.mock('../../services/spendingInsights.service', () => ({
    fetchGroupSpendingByCategory: jest.fn().mockResolvedValue([]),
    fetchGroupSpendingByMember: jest.fn().mockResolvedValue([]),
    fetchGroupSpendingByWeek: jest.fn().mockResolvedValue([]),
}));

describe('SpendingInsightsSheet', () => {
    it('shows locked upsell when Pro is locked', () => {
        const { getByText } = renderWithQuery(
            <SpendingInsightsSheet
                visible
                groupId="g1"
                defaultCurrency="USD"
                memberNames={{}}
                unlocked={false}
                onClose={jest.fn()}
                onUpgrade={jest.fn()}
            />,
        );
        expect(getByText('pro.spendingInsights.upgrade')).toBeTruthy();
    });
});
