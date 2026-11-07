import type { GroupWithMembers } from '@cost-share/shared';

jest.mock('../../services/proEntitlements.service', () => ({
    fetchMyProStatus: jest.fn(),
}));

jest.mock('../../services/purchases.service', () => ({
    isPurchasesConfigured: jest.fn(() => true),
    waitForPurchasesReady: jest.fn(async () => true),
    fetchPurchasesCustomerInfo: jest.fn(),
    loadOfferingPackages: jest.fn(),
    loadOfferingAllPackages: jest.fn(),
    fetchLocalizedProductPriceString: jest.fn(),
}));

import { fetchMyProStatus } from '../../services/proEntitlements.service';
import {
    fetchLocalizedProductPriceString,
    fetchPurchasesCustomerInfo,
    loadOfferingAllPackages,
    loadOfferingPackages,
} from '../../services/purchases.service';
import { fetchMySubscriptionSnapshot } from '../../services/mySubscription.service';

const statusMock = fetchMyProStatus as jest.MockedFunction<typeof fetchMyProStatus>;
const infoMock = fetchPurchasesCustomerInfo as jest.MockedFunction<typeof fetchPurchasesCustomerInfo>;
const packagesMock = loadOfferingPackages as jest.MockedFunction<typeof loadOfferingPackages>;
const allPackagesMock = loadOfferingAllPackages as jest.MockedFunction<typeof loadOfferingAllPackages>;
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

    it('prefers StoreKit getProducts localized price over offering USD priceString', async () => {
        localizedMock.mockResolvedValue('₪12.90');
        const monthly = {
            identifier: '$rc_monthly',
            product: { identifier: 'kupapay_pro_monthly', priceString: '$3.99' },
        };
        packagesMock.mockResolvedValue({
            monthly,
            annual: null,
            tripPass: null,
        });
        allPackagesMock.mockResolvedValue([monthly]);
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
        expect(localizedMock).toHaveBeenCalledWith('kupapay_pro_monthly');
    });
});
