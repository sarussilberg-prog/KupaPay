import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { MyProStatus } from '../../services/proEntitlements.service';
import { ProPaywallContent } from '../../components/pro/ProPaywallContent';
import { RtlLayoutProvider } from '../../hooks/useRtlLayout';

type MockProStatusHook = {
    hasPro: boolean;
    proPerkUnlocked: boolean;
    isLoading: boolean;
    isError: boolean;
    data: MyProStatus | undefined;
    adminProViewMode: MyProStatus['adminProViewMode'];
    adminProViewOverrideActive: boolean;
    adminProViewExpiresAt: string | null;
};

function renderPaywall(ui: React.ReactElement) {
    return render(<RtlLayoutProvider>{ui}</RtlLayoutProvider>);
}

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { trialDays?: number }) =>
            opts?.trialDays != null ? `${key}:${opts.trialDays}` : key,
        i18n: { language: 'en' },
    }),
}));


jest.mock('../../services/monetization.service', () => ({
    logMonetizationEvent: jest.fn(),
}));

jest.mock('../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(),
    getProductAnalyticsClient: jest.fn(() => null),
}));

jest.mock('../../lib/paywallOfferingsLoad', () => ({
    ...jest.requireActual('../../lib/paywallOfferingsLoad'),
    fetchPaywallOfferings: jest.fn(),
    reportPaywallLoadFailed: jest.fn(),
}));

const mockUseProStatus = jest.fn((_groupId?: string | null): MockProStatusHook => ({
    hasPro: false,
    proPerkUnlocked: false,
    isLoading: false,
    isError: false,
    data: undefined,
    adminProViewMode: 'real' as const,
    adminProViewOverrideActive: false,
    adminProViewExpiresAt: null,
}));

jest.mock('../../hooks/useProStatus', () => ({
    useProStatus: (groupId?: string | null) => mockUseProStatus(groupId),
}));

jest.mock('../../hooks/useMySubscription', () => ({
    useMySubscription: jest.fn(() => ({
        data: null,
        isLoading: false,
    })),
}));

jest.mock('../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
}));

jest.mock('../../services/purchases.service', () => ({
    isPurchasesConfigured: jest.fn(() => true),
    loadOfferingPackages: jest.fn(),
    checkIntroductoryPriceEligibility: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    openSubscriptionManagement: jest.fn(),
    presentOfferCodeRedemption: jest.fn(),
}));

jest.mock('../../components/pro/PromoCodeRedeemSheet', () => {
    const { View } = require('react-native');
    return {
        PromoCodeRedeemSheet: ({ visible }: { visible: boolean }) =>
            visible ? <View testID="promo-sheet-open" /> : null,
    };
});

import { fetchPaywallOfferings } from '../../lib/paywallOfferingsLoad';
import { purchasePackage } from '../../services/purchases.service';

const fetchMock = fetchPaywallOfferings as jest.MockedFunction<typeof fetchPaywallOfferings>;
const purchaseMock = purchasePackage as jest.MockedFunction<typeof purchasePackage>;

const defaultProStatusMock = () => ({
    hasPro: false,
    proPerkUnlocked: false,
    isLoading: false,
    isError: false,
    data: undefined,
    adminProViewMode: 'real' as const,
    adminProViewOverrideActive: false,
    adminProViewExpiresAt: null,
});

beforeEach(() => {
    mockUseProStatus.mockImplementation(defaultProStatusMock);
});

const mockPackage = {
    identifier: 'annual',
    product: {
        identifier: 'kupapay_pro_yearly',
        priceString: '₪69.90',
        introPrice: { price: 0, priceString: '₪0.00', periodNumberOfUnits: 2, periodUnit: 'WEEK' },
    },
} as const;

const mockMonthly = {
    identifier: 'monthly',
    product: { identifier: 'kupapay_pro_monthly', priceString: '₪12.90' },
} as const;

describe('ProPaywallContent offerings load', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseProStatus.mockImplementation(defaultProStatusMock);
    });

    it('shows error and retry when offerings load fails', async () => {
        fetchMock.mockResolvedValue({ status: 'failed', reason: 'empty' });

        const { getByTestId, queryByTestId } = renderPaywall(
            <ProPaywallContent featureKey="export_pdf" />,
        );

        await waitFor(() => {
            expect(getByTestId('paywall-load-error')).toBeTruthy();
        });
        expect(getByTestId('paywall-retry')).toBeTruthy();
        expect(queryByTestId('paywall-loading')).toBeNull();
    });

    it('renders Trip Pass as third plan picker when showTripPass is default', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: mockMonthly,
                annual: mockPackage,
                tripPass: null,
            },
            introEligibility: {},
        });

        const { findByTestId } = renderPaywall(<ProPaywallContent featureKey="export_pdf" />);

        expect(await findByTestId('paywall-pick-trip-pass')).toBeTruthy();
    });

    it('shows ILS fallback prices when RevenueCat omits priceString', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: {
                    identifier: 'monthly',
                    product: { identifier: 'kupapay_pro_monthly', priceString: '' },
                },
                annual: {
                    identifier: 'annual',
                    product: { identifier: 'kupapay_pro_yearly', priceString: '' },
                },
                tripPass: {
                    identifier: 'trip_pass',
                    product: { identifier: 'kupapay_trip_pass', priceString: '' },
                },
            },
            introEligibility: {},
        });

        const { findByText, getByText } = renderPaywall(
            <ProPaywallContent featureKey="export_pdf" showTripPass />,
        );

        expect(await findByText('₪12.90')).toBeTruthy();
        expect(getByText('₪69.90')).toBeTruthy();
        expect(getByText('₪19.90')).toBeTruthy();
    });

    it('shows localized store prices from RevenueCat packages', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: mockMonthly,
                annual: mockPackage,
                tripPass: null,
            },
            introEligibility: {},
        });

        const { getByText, findByText } = renderPaywall(
            <ProPaywallContent featureKey="export_pdf" showTripPass={false} />,
        );

        expect(await findByText('₪12.90')).toBeTruthy();
        expect(getByText('₪69.90')).toBeTruthy();
    });

    it('shows 14-day free trial CTA for eligible yearly plan', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: mockMonthly,
                annual: mockPackage,
                tripPass: null,
            },
            introEligibility: {
                kupapay_pro_yearly: { status: 2 },
            },
        });

        const { findByText } = renderPaywall(
            <ProPaywallContent featureKey="export_pdf" showTripPass={false} />,
        );

        expect(await findByText('pro.paywall.tryFreeTrialCta:14')).toBeTruthy();
    });

    it('does not show EU withdrawal acknowledgement on the paywall', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: mockMonthly,
                annual: mockPackage,
                tripPass: null,
            },
            introEligibility: {},
        });
        purchaseMock.mockResolvedValue({ ok: true });

        const { queryByTestId, getByTestId } = renderPaywall(
            <ProPaywallContent featureKey="export_pdf" showTripPass={false} />,
        );

        await waitFor(() => {
            expect(queryByTestId('paywall-loading')).toBeNull();
        });
        expect(queryByTestId('paywall-eu-withdrawal-ack')).toBeNull();

        fireEvent.press(getByTestId('paywall-purchase-btn'));
        await waitFor(() => {
            expect(purchaseMock).toHaveBeenCalled();
        });
    });

    it('hides Trip Pass when hasPro is true without a subscription snapshot (admin force / store sync)', async () => {
        mockUseProStatus.mockReturnValue({
            hasPro: true,
            proPerkUnlocked: true,
            isLoading: false,
            isError: false,
            data: {
                hasPro: true,
                individualProUntil: null,
                groupPassUntil: null,
                includedTripPassCredits: 0,
                unassignedTripPassCount: 0,
                adminProViewMode: 'force_pro' as const,
                adminProViewExpiresAt: '2027-01-01T00:00:00.000Z',
            },
            adminProViewMode: 'force_pro' as const,
            adminProViewOverrideActive: true,
            adminProViewExpiresAt: '2027-01-01T00:00:00.000Z',
        });
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: mockMonthly,
                annual: mockPackage,
                tripPass: {
                    identifier: 'trip_pass',
                    product: { identifier: 'kupapay_trip_pass', priceString: '₪19.90' },
                },
            },
            introEligibility: {},
        });

        const { queryByTestId, getByTestId } = renderPaywall(
            <ProPaywallContent featureKey="settings" showTripPass groupId="g1" />,
        );

        await waitFor(() => {
            expect(getByTestId('paywall-already-pro')).toBeTruthy();
        });
        expect(queryByTestId('paywall-pick-trip-pass')).toBeNull();
    });

    it('hides Trip Pass when the user has an active individual Pro subscription', async () => {
        mockUseProStatus.mockReturnValue({
            hasPro: true,
            proPerkUnlocked: true,
            isLoading: false,
            isError: false,
            data: {
                hasPro: true,
                individualProUntil: '2027-01-01T00:00:00.000Z',
                groupPassUntil: null,
                includedTripPassCredits: 0,
                unassignedTripPassCount: 0,
                adminProViewMode: 'real' as const,
                adminProViewExpiresAt: null,
            },
            adminProViewMode: 'real' as const,
            adminProViewOverrideActive: false,
            adminProViewExpiresAt: null,
        });
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: mockMonthly,
                annual: mockPackage,
                tripPass: {
                    identifier: 'trip_pass',
                    product: { identifier: 'kupapay_trip_pass', priceString: '₪19.90' },
                },
            },
            introEligibility: {},
        });

        const { queryByTestId, getByTestId } = renderPaywall(
            <ProPaywallContent featureKey="settings" showTripPass />,
        );

        await waitFor(() => {
            expect(getByTestId('paywall-already-pro')).toBeTruthy();
        });
        expect(queryByTestId('paywall-pick-trip-pass')).toBeNull();
    });

    it('opens promo code sheet from Have a code link', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: { monthly: mockMonthly, annual: mockPackage, tripPass: null },
            introEligibility: {},
        });

        const { getByTestId, queryByTestId } = renderPaywall(<ProPaywallContent featureKey="export_pdf" />);

        await waitFor(() => {
            expect(getByTestId('paywall-redeem-code')).toBeTruthy();
        });

        fireEvent.press(getByTestId('paywall-redeem-code'));
        expect(queryByTestId('promo-sheet-open')).toBeTruthy();
    });
});
