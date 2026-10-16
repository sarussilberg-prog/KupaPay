import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProPaywallContent } from '../../components/pro/ProPaywallContent';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
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
}));

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

    it('allows purchase without EU withdrawal acknowledgement', async () => {
        fetchMock.mockResolvedValue({
            status: 'ready',
            packages: {
                monthly: {
                    ...mockPackage,
                    identifier: 'monthly',
                    product: { ...mockPackage.product, identifier: 'kupapay_pro_monthly' },
                },
                annual: mockPackage,
                tripPass: null,
            },
            introEligibility: {
                kupapay_pro_yearly: { status: 2 },
            },
        });
        purchaseMock.mockResolvedValue({ ok: true });

        const { getByTestId, queryByTestId } = render(
            <ProPaywallContent featureKey="export_pdf" showTripPass={false} />,
        );

        await waitFor(() => {
            expect(queryByTestId('paywall-loading')).toBeNull();
            expect(getByTestId('paywall-purchase-btn')).toBeTruthy();
        });

        fireEvent.press(getByTestId('paywall-purchase-btn'));
        await waitFor(() => {
            expect(purchaseMock).toHaveBeenCalled();
        });
    });
});
