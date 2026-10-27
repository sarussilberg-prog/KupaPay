import React from 'react';
import { render } from '@testing-library/react-native';
import { MySubscriptionPanel } from '../../../components/pro/MySubscriptionPanel';
import type { MySubscriptionSnapshot } from '@cost-share/shared';

jest.mock('../../../services/purchases.service', () => ({
    isPurchasesConfigured: () => true,
    restorePurchases: jest.fn(),
}));

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
});
