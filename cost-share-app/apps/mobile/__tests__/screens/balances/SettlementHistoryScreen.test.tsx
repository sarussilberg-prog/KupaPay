import React from 'react';
import { renderWithQuery } from '../../helpers/renderWithQuery';

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
        useRoute: () => ({ params: { groupId: 'g1' } }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/settlements.service', () => ({
    fetchSettlements: jest.fn(),
    fetchConsolidationBatches: jest.fn().mockResolvedValue([]),
    deleteSettlement: jest.fn(),
}));

jest.mock('../../../services/users.service', () => ({
    fetchGroupUsers: jest.fn().mockResolvedValue([
        { id: 'u1', email: 'a@x.com', name: 'Alice', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date() },
        { id: 'u2', email: 'b@x.com', name: 'Bob', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date() },
    ]),
}));

import { SettlementHistoryScreen } from '../../../screens/balances/SettlementHistoryScreen';
import { fetchSettlements } from '../../../services/settlements.service';
import { queryClient } from '../../../lib/queryClient';

const mockFetch = fetchSettlements as jest.MockedFunction<typeof fetchSettlements>;

beforeEach(() => {
    mockFetch.mockReset();
    // renderWithQuery uses a singleton client; clear cache for test isolation.
    queryClient.clear();
});

describe('SettlementHistoryScreen', () => {
    it('shows empty state when there are no settlements', async () => {
        mockFetch.mockResolvedValueOnce([]);
        const { findByText } = renderWithQuery(<SettlementHistoryScreen />);
        expect(await findByText('balances.noSettlements')).toBeTruthy();
    });

    it('renders a settlement row with its amount', async () => {
        mockFetch.mockResolvedValueOnce([
            {
                id: 's1',
                groupId: 'g1',
                fromUserId: 'u1',
                toUserId: 'u2',
                amount: 100,
                currency: 'USD',
                settlementDate: new Date('2026-05-01'),
                paymentMethod: 'cash',
                createdBy: 'u1',
                createdAt: new Date(),
            } as any,
        ]);
        const { findByText, getByTestId } = renderWithQuery(<SettlementHistoryScreen />);
        // The row uses perspective-based feed copy; currency + amount render as
        // separate text nodes, so assert the row and the amount node.
        expect(await findByText(/^100(\.00)?$/)).toBeTruthy();
        expect(getByTestId('settlement-press-s1')).toBeTruthy();
    });
});
