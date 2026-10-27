import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('expo-store-review', () => ({
    requestReview: jest.fn(),
    isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../hooks/useSystemNotificationsDenied', () => ({
    useSystemNotificationsDenied: () => false,
}));

jest.mock('../../../services/auth.service', () => ({ signOut: jest.fn() }));
jest.mock('../../../hooks/useChangeAppLanguage', () => ({
    useChangeAppLanguage: () => jest.fn(),
}));
jest.mock('../../../services/account.service', () => ({
    deleteMyAccount: jest.fn(),
    getMyOpenBalances: jest.fn().mockResolvedValue({
        hasOpenBalances: false,
        totalOwed: 0,
        totalOwing: 0,
        currency: 'ILS',
    }),
}));
jest.mock('../../../services/users.service', () => ({
    updateUser: jest.fn(),
    refreshCurrentUserAdminFlag: jest.fn(),
}));

jest.mock('../../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
}));

jest.mock('../../../services/purchases.service', () => ({
    isPurchasesConfigured: () => true,
    fetchProSubscriptionUiState: jest.fn().mockResolvedValue({
        isInFreeTrial: false,
        trialEndsAt: null,
        manageSubscriptionsAvailable: true,
    }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (cb: () => void) => cb(),
}));

jest.mock('../../../hooks/useProStatus', () => ({
    useProStatus: jest.fn(),
}));

jest.mock('../../../hooks/useShowProUpsell', () => ({
    useShowProUpsell: jest.fn(),
}));

jest.mock('../../../hooks/useMySubscription', () => ({
    useMySubscription: jest.fn(),
}));

import { SettingsScreen } from '../../../screens/profile/SettingsScreen';
import { useProStatus } from '../../../hooks/useProStatus';
import { useShowProUpsell } from '../../../hooks/useShowProUpsell';
import { useMySubscription } from '../../../hooks/useMySubscription';
import { useAppStore } from '../../../store';

const useProStatusMock = useProStatus as jest.MockedFunction<typeof useProStatus>;
const useShowProUpsellMock = useShowProUpsell as jest.MockedFunction<typeof useShowProUpsell>;
const useMySubscriptionMock = useMySubscription as jest.MockedFunction<typeof useMySubscription>;

function renderSettings() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <SettingsScreen />
        </QueryClientProvider>,
    );
}

describe('SettingsScreen Pro section', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        useMySubscriptionMock.mockReturnValue({
            data: {
                lifecycle: 'active',
                planKind: 'yearly',
                priceString: '₪69.90',
                renewalOrExpiryIso: '2027-06-01T00:00:00.000Z',
                autoRenew: true,
                store: 'app_store',
                storeProductId: 'kupapay_pro_yearly',
                storePlanId: null,
                isFreeTrial: false,
                tripPasses: [],
                serverIndividualUntil: '2027-06-01T00:00:00.000Z',
            },
            isLoading: false,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useMySubscription>);
        useAppStore.setState({
            language: 'he',
            currentUser: {
                id: 'u1',
                email: 'a@x.com',
                name: 'Alice',
                inviteToken: 'alice123456',
                defaultCurrency: 'ILS',
                language: 'he',
                isActive: true,
                isAdmin: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    });

    it('hides Go Pro when user has Pro and shows manage subscription', () => {
        useProStatusMock.mockReturnValue({
            hasPro: true,
            data: {
                hasPro: true,
                individualProUntil: '2027-06-01T00:00:00.000Z',
                groupPassUntil: null,
                includedTripPassCredits: 0,
                unassignedTripPassCount: 0,
                adminProViewMode: 'real',
                adminProViewExpiresAt: null,
            },
        } as ReturnType<typeof useProStatus>);
        useShowProUpsellMock.mockReturnValue(false);

        const { getByTestId, queryByTestId } = renderSettings();
        expect(getByTestId('settings-manage-subscription')).toBeTruthy();
        expect(getByTestId('my-subscription-panel')).toBeTruthy();
        expect(queryByTestId('settings-go-pro')).toBeNull();
    });

    it('shows Go Pro when user lacks Pro', () => {
        useProStatusMock.mockReturnValue({
            hasPro: false,
            data: {
                hasPro: false,
                individualProUntil: null,
                groupPassUntil: null,
                includedTripPassCredits: 0,
                unassignedTripPassCount: 0,
                adminProViewMode: 'real',
                adminProViewExpiresAt: null,
            },
        } as ReturnType<typeof useProStatus>);
        useShowProUpsellMock.mockReturnValue(true);

        const { getByTestId } = renderSettings();
        fireEvent.press(getByTestId('settings-go-pro'));
        expect(mockNavigate).toHaveBeenCalledWith('Paywall', { featureKey: 'settings' });
    });
});
