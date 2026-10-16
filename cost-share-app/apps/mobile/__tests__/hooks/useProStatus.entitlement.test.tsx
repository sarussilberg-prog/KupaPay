import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProStatus } from '../../hooks/useProStatus';
import { fetchMyProStatus } from '../../services/proEntitlements.service';

jest.mock('../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
}));

jest.mock('../../services/proEntitlements.service', () => ({
    fetchMyProStatus: jest.fn(),
}));

jest.mock('../../store', () => ({
    useAppStore: (selector: (s: { currentUser: { isAdmin: boolean } | null }) => unknown) =>
        selector({ currentUser: { isAdmin: true } }),
}));

const fetchMock = fetchMyProStatus as jest.MockedFunction<typeof fetchMyProStatus>;

function Probe() {
    const { hasPro, proPerkUnlocked } = useProStatus();
    return (
        <Text testID="probe">
            {hasPro ? 'pro' : 'free'}-{proPerkUnlocked ? 'unlocked' : 'locked'}
        </Text>
    );
}

describe('useProStatus entitlement', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it('unlocks perks when admin force_pro even if server hasPro is false', async () => {
        fetchMock.mockResolvedValue({
            hasPro: false,
            adminProViewMode: 'force_pro',
            adminProViewExpiresAt: '2030-01-01T00:00:00.000Z',
            individualProUntil: null,
            groupPassUntil: null,
            includedTripPassCredits: 0,
            unassignedTripPassCount: 0,
        });

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { getByTestId } = render(
            <QueryClientProvider client={client}>
                <Probe />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(getByTestId('probe')).toHaveTextContent('pro-unlocked');
        });
    });
});
