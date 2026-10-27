import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupProPassBanner } from '../../../components/groups/GroupProPassBanner';

jest.mock('../../../hooks/queries/useProStatusQuery', () => ({
    useProStatusQuery: jest.fn(),
}));

import { useProStatusQuery } from '../../../hooks/queries/useProStatusQuery';

const mockUseProStatusQuery = useProStatusQuery as jest.MockedFunction<typeof useProStatusQuery>;

describe('GroupProPassBanner', () => {
    it('renders expiry when group pass is active', () => {
        mockUseProStatusQuery.mockReturnValue({
            hasPro: true,
            data: {
                hasPro: true,
                groupPassUntil: '2026-12-01T00:00:00.000Z',
                individualProUntil: null,
                includedTripPassCredits: 0,
                unassignedTripPassCount: 0,
                adminProViewMode: 'real',
                adminProViewExpiresAt: null,
            },
        } as ReturnType<typeof useProStatusQuery>);

        const { getByTestId } = render(<GroupProPassBanner groupId="g1" />);
        expect(getByTestId('group-pro-pass-banner')).toBeTruthy();
    });

    it('renders nothing without an active group pass', () => {
        mockUseProStatusQuery.mockReturnValue({
            hasPro: true,
            data: {
                hasPro: true,
                groupPassUntil: null,
                individualProUntil: '2026-12-01T00:00:00.000Z',
                includedTripPassCredits: 0,
                unassignedTripPassCount: 0,
                adminProViewMode: 'real',
                adminProViewExpiresAt: null,
            },
        } as ReturnType<typeof useProStatusQuery>);

        const { queryByTestId } = render(<GroupProPassBanner groupId="g1" />);
        expect(queryByTestId('group-pro-pass-banner')).toBeNull();
    });
});
