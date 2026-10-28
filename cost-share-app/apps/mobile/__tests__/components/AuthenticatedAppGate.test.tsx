import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { AuthenticatedAppGate } from '../../components/AuthenticatedAppGate';
import { runAuthenticatedGate } from '../../lib/authenticatedGateResolve';

jest.mock('../../lib/authenticatedGateResolve', () => ({
    runAuthenticatedGate: jest.fn(),
}));

jest.mock('../../hooks/useAuthenticatedInviteRedemption', () => ({
    useAuthenticatedInviteRedemption: jest.fn(),
}));

jest.mock('../../hooks/useAvatarPrefetcher', () => ({
    useAvatarPrefetcher: jest.fn(),
}));

jest.mock('../../navigation/AppNavigator', () => ({
    AppNavigator: () => {
        const { Text } = require('react-native');
        return <Text testID="main-nav">main</Text>;
    },
}));

jest.mock('../../screens/onboarding/ActivationOnboardingScreen', () => ({
    ActivationOnboardingScreen: ({ onDone }: { onDone: () => void }) => {
        const { Text, TouchableOpacity } = require('react-native');
        return (
            <TouchableOpacity testID="create-done" onPress={onDone}>
                <Text testID="create-screen">create</Text>
            </TouchableOpacity>
        );
    },
}));

jest.mock('../../components/skeletons/AppGateSkeleton', () => ({
    AppGateSkeleton: () => {
        const { Text } = require('react-native');
        return <Text testID="gate-skeleton">loading</Text>;
    },
}));

jest.mock('../../components/admin/AdminProViewBanner', () => ({
    AdminProViewBanner: () => null,
}));

jest.mock('../../components/NetworkOfflineBanner', () => ({
    NetworkOfflineBanner: () => null,
}));

jest.mock('../../components/appReview/AppReviewPromptHost', () => ({
    AppReviewPromptHost: () => null,
}));

jest.mock('../../hooks/useSubscriptionRefreshOnForeground', () => ({
    useSubscriptionRefreshOnForeground: jest.fn(),
}));

jest.mock('../../lib/sentry', () => ({
    navigationIntegration: { registerNavigationContainer: jest.fn() },
}));

const mockRunGate = runAuthenticatedGate as jest.MockedFunction<typeof runAuthenticatedGate>;

describe('AuthenticatedAppGate', () => {
    beforeEach(() => {
        mockRunGate.mockReset();
    });

    it('shows create-group onboarding when gate resolves to create', async () => {
        mockRunGate.mockResolvedValue('create');
        const { getByTestId } = render(<AuthenticatedAppGate />);
        await waitFor(() => {
            expect(getByTestId('create-screen')).toBeTruthy();
        });
    });

    it('mounts main navigator when gate resolves to main', async () => {
        mockRunGate.mockResolvedValue('main');
        const { getByTestId } = render(<AuthenticatedAppGate />);
        await waitFor(() => {
            expect(getByTestId('main-nav')).toBeTruthy();
        });
    });

    it('transitions from create to main after activation onboarding completes', async () => {
        mockRunGate.mockResolvedValue('create');
        const { getByTestId, queryByTestId } = render(<AuthenticatedAppGate />);
        await waitFor(() => expect(getByTestId('create-screen')).toBeTruthy());
        fireEvent.press(getByTestId('create-done'));
        await waitFor(() => {
            expect(getByTestId('main-nav')).toBeTruthy();
            expect(queryByTestId('create-screen')).toBeNull();
        });
    });
});
