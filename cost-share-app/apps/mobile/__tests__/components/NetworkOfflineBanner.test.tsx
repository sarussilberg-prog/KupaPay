import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NetworkOfflineBanner } from '../../components/NetworkOfflineBanner';

const mockUseNetworkStatus = jest.fn();
jest.mock('../../lib/networkStatus', () => ({
    useNetworkStatus: () => mockUseNetworkStatus(),
}));

const mockRetry = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/reconnectSync', () => ({
    retryConnectivitySync: (...args: unknown[]) => mockRetry(...args),
}));

function wrap(ui: React.ReactElement) {
    const client = new QueryClient();
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('NetworkOfflineBanner', () => {
    beforeEach(() => {
        mockUseNetworkStatus.mockReset();
        mockRetry.mockClear();
    });

    const platforms = ['ios', 'android', 'web'] as const;

    it.each(platforms)('hidden when online (%s)', (platform) => {
        jest.replaceProperty(require('react-native').Platform, 'OS', platform);
        mockUseNetworkStatus.mockReturnValue({ online: true });
        const { queryByTestId } = wrap(<NetworkOfflineBanner />);
        expect(queryByTestId('network-offline-banner')).toBeNull();
    });

    it.each(platforms)('shows banner and retry when offline (%s)', async (platform) => {
        jest.replaceProperty(require('react-native').Platform, 'OS', platform);
        mockUseNetworkStatus.mockReturnValue({ online: false });
        const { getByTestId } = wrap(<NetworkOfflineBanner />);
        expect(getByTestId('network-offline-banner')).toBeTruthy();
        fireEvent.press(getByTestId('network-offline-banner-retry'));
        await waitFor(() => expect(mockRetry).toHaveBeenCalledTimes(1));
    });
});
