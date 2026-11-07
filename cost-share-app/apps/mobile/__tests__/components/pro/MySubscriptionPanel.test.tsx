import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { MySubscriptionPanel } from '../../../components/pro/MySubscriptionPanel';
import type { MySubscriptionSnapshot } from '@cost-share/shared';
import { restorePurchases } from '../../../services/purchases.service';
import { showAppToast } from '../../../lib/appToast';

jest.mock('../../../services/purchases.service', () => ({
    isPurchasesConfigured: () => true,
    restorePurchases: jest.fn(),
}));

jest.mock('../../../lib/appToast', () => ({
    showAppToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' },
    }),
}));

jest.mock('../../../store', () => ({
    useAppStore: (selector: (state: { language: 'en' }) => unknown) =>
        selector({ language: 'en' }),
}));

const restoreMock = restorePurchases as jest.MockedFunction<typeof restorePurchases>;
const showAppToastMock = showAppToast as jest.MockedFunction<typeof showAppToast>;

const activeSnapshot: MySubscriptionSnapshot = {
    lifecycle: 'active',
    planKind: 'yearly',
    priceString: '₪69.90',
    renewalOrExpiryIso: '2027-01-15T00:00:00.000Z',
    autoRenew: true,
    store: 'app_store',
    storeProductId: 'kupapay_pro_yearly',
    storePlanId: null,
    isFreeTrial: false,
    tripPasses: [
        { groupId: 'g1', groupName: 'Barcelona Trip', expiresAt: '2026-12-20T00:00:00.000Z' },
    ],
    serverIndividualUntil: '2027-01-15T00:00:00.000Z',
};

describe('MySubscriptionPanel', () => {
    it('renders plan, price, and trip pass group', () => {
        const { getByTestId, getByText } = render(
            <MySubscriptionPanel snapshot={activeSnapshot} compact />,
        );
        expect(getByTestId('my-subscription-panel')).toBeTruthy();
        expect(getByText('₪69.90')).toBeTruthy();
        expect(getByText('Barcelona Trip')).toBeTruthy();
    });

    it('shows fix payment for billing issue', () => {
        const snap = { ...activeSnapshot, lifecycle: 'billing_issue' as const };
        const { getByTestId } = render(<MySubscriptionPanel snapshot={snap} />);
        expect(getByTestId('my-subscription-fix-payment')).toBeTruthy();
    });

    it('shows restore hint under the restore link', () => {
        const { getByText } = render(<MySubscriptionPanel snapshot={activeSnapshot} />);
        expect(getByText('pro.paywall.restoreHint')).toBeTruthy();
    });

    it('toasts pro restored when restore finds a subscription', async () => {
        restoreMock.mockResolvedValue({ status: 'pro_restored' });
        const onRestoreSuccess = jest.fn();
        const { getByTestId } = render(
            <MySubscriptionPanel snapshot={activeSnapshot} onRestoreSuccess={onRestoreSuccess} />,
        );
        fireEvent.press(getByTestId('my-subscription-restore'));
        await waitFor(() => {
            expect(showAppToastMock).toHaveBeenCalledWith({
                type: 'success',
                titleKey: 'pro.paywall.restoreProRestored',
            });
        });
        expect(onRestoreSuccess).toHaveBeenCalled();
    });

    it('disables restore while restore is in progress', async () => {
        let resolveRestore: (value: { status: 'none' }) => void = () => {};
        restoreMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveRestore = resolve;
                }),
        );
        const { getByTestId, UNSAFE_getByType } = render(
            <MySubscriptionPanel snapshot={activeSnapshot} />,
        );
        fireEvent.press(getByTestId('my-subscription-restore'));
        await waitFor(() => {
            expect(UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
        });
        resolveRestore({ status: 'none' });
    });
});
