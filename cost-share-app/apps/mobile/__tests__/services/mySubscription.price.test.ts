import type { GroupWithMembers } from '@cost-share/shared';

jest.mock('../../services/proEntitlements.service', () => ({
    fetchMyProStatus: jest.fn(),
}));

jest.mock('../../services/purchases.service', () => ({
    isPurchasesConfigured: jest.fn(() => true),
    waitForPurchasesReady: jest.fn(async () => true),
    fetchPurchasesCustomerInfo: jest.fn(),
    fetchLocalizedProductPriceString: jest.fn(),
}));

import { fetchMyProStatus } from '../../services/proEntitlements.service';
import {
    fetchLocalizedProductPriceString,
    fetchPurchasesCustomerInfo,
} from '../../services/purchases.service';
import { fetchMySubscriptionSnapshot } from '../../services/mySubscription.service';

const statusMock = fetchMyProStatus as jest.MockedFunction<typeof fetchMyProStatus>;
const infoMock = fetchPurchasesCustomerInfo as jest.MockedFunction<typeof fetchPurchasesCustomerInfo>;
const localizedMock = fetchLocalizedProductPriceString as jest.MockedFunction<
    typeof fetchLocalizedProductPriceString
>;

const groups = [] as GroupWithMembers[];

describe('fetchMySubscriptionSnapshot priceString', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        statusMock.mockResolvedValue({
            hasPro: true,
            individualProUntil: '2027-01-01T00:00:00.000Z',
            groupPassUntil: null,
            includedTripPassCredits: 0,
            unassignedTripPassCount: 0,
            adminProViewMode: 'real',
            adminProViewExpiresAt: null,
        });
    });

    it('uses StoreKit getProducts localized price only', async () => {
        localizedMock.mockResolvedValue('₪12.90');
        infoMock.mockResolvedValue({
            entitlements: {
                active: {
                    pro: {
                        identifier: 'pro',
                        isActive: true,
                        willRenew: true,
                        productIdentifier: 'kupapay_pro_monthly',
                        expirationDate: '2027-01-01T00:00:00.000Z',
                    },
                },
                all: {},
            },
        } as never);

        const snap = await fetchMySubscriptionSnapshot(groups);
        expect(snap?.priceString).toBe('₪12.90');
        expect(localizedMock).toHaveBeenCalledWith('kupapay_pro_monthly', null);
    });

    it('omits price when StoreKit returns no localized priceString', async () => {
        localizedMock.mockResolvedValue(null);
        infoMock.mockResolvedValue({
            entitlements: {
                active: {
                    pro: {
                        identifier: 'pro',
                        isActive: true,
                        willRenew: true,
                        productIdentifier: 'kupapay_pro_monthly',
                        expirationDate: '2027-01-01T00:00:00.000Z',
                    },
                },
                all: {},
            },
        } as never);

        const snap = await fetchMySubscriptionSnapshot(groups);
        expect(snap?.priceString).toBeNull();
    });
});
