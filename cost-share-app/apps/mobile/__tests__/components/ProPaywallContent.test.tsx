import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProPaywallContent } from '../../components/pro/ProPaywallContent';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { trialDays?: number }) =>
            opts?.trialDays != null ? `${key}:${opts.trialDays}` : key,
        i18n: { language: 'en' },
    }),
}));

jest.mock('../../hooks/useRtlLayout', () => ({
    useAppLanguage: () => 'en',
    useRtlLayout: () => false,
    rtlTextClassName: () => '',
    resolveAutoTextStyle: () => undefined,
}));

jest.mock('../../services/monetization.service', () => ({
    logMonetizationEvent: jest.fn(),
}));

jest.mock('../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(),
}));

jest.mock('../../lib/paywallOfferingsLoad', () => ({
    ...jest.requireActual('../../lib/paywallOfferingsLoad'),
    fetchPaywallOfferings: jest.fn(),
    reportPaywallLoadFailed: jest.fn(),
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
    });

    it('shows error and retry when offerings load fails', async () => {
        fetchMock.mockResolvedValue({ status: 'failed', reason: 'empty' });

        const { getByTestId, queryByTestId } = render(
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

        const { findByTestId } = render(<ProPaywallContent featureKey="export_pdf" />);

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

        const { findByText, getByText } = render(
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

        const { getByText, findByText } = render(
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

        const { findByText } = render(
            <ProPaywallContent featureKey="export_pdf" showTripPass={false} />,
        );

        expect(await findByText('pro.paywall.tryFreeTrialCta:14')).toBeTruthy();
    });

    it('never shows EU withdrawal acknowledgement', async () => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });

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
        purchaseMock.mockResolvedValue({ ok: true });

        const { queryByTestId, getByTestId } = render(
            <ProPaywallContent featureKey="export_pdf" showTripPass={false} />,
        );

        await waitFor(() => {
            expect(queryByTestId('paywall-loading')).toBeNull();
            expect(getByTestId('paywall-purchase-btn')).toBeTruthy();
        });
        expect(queryByTestId('paywall-eu-withdrawal-ack')).toBeNull();

        fireEvent.press(getByTestId('paywall-purchase-btn'));
        await waitFor(() => {
            expect(purchaseMock).toHaveBeenCalled();
        });

        Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    });

    it('opens promo code sheet from Have a code link', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: { monthly: mockMonthly, annual: mockPackage, tripPass: null },
            introEligibility: {},
        });

        const { getByTestId, queryByTestId } = render(<ProPaywallContent featureKey="export_pdf" />);

        await waitFor(() => {
            expect(getByTestId('paywall-redeem-code')).toBeTruthy();
        });

        fireEvent.press(getByTestId('paywall-redeem-code'));
        expect(queryByTestId('promo-sheet-open')).toBeTruthy();
    });
});
