import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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

const fetchMock = fetchPaywallOfferings as jest.MockedFunction<typeof fetchPaywallOfferings>;

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
});
