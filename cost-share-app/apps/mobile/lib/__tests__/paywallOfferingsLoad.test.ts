jest.mock('../productAnalytics', () => ({
    captureProductEvent: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
    captureMessage: jest.fn(),
}));

import {
    fetchPaywallOfferings,
    isPaywallPackagesEmpty,
    PAYWALL_OFFERINGS_LOAD_TIMEOUT_MS,
    reportPaywallLoadFailed,
    withTimeout,
} from '../paywallOfferingsLoad';
import { captureProductEvent } from '../productAnalytics';
import * as Sentry from '@sentry/react-native';

describe('paywallOfferingsLoad', () => {
    it('detects empty package sets', () => {
        expect(isPaywallPackagesEmpty(null)).toBe(true);
        expect(isPaywallPackagesEmpty({ monthly: null, annual: null, tripPass: null })).toBe(true);
        expect(
            isPaywallPackagesEmpty({
                monthly: { identifier: 'm', product: { identifier: 'm', priceString: '$1' } },
                annual: null,
                tripPass: null,
            }),
        ).toBe(false);
    });

    it('withTimeout rejects when the promise does not settle in time', async () => {
        await expect(
            withTimeout(new Promise(() => {}), 20, 'timeout'),
        ).rejects.toThrow('timeout');
    });

    it('fetchPaywallOfferings fails when packages are empty', async () => {
        const result = await fetchPaywallOfferings({
            loadPackages: async () => ({ monthly: null, annual: null, tripPass: null }),
            checkEligibility: async () => ({}),
            timeoutMs: 100,
        });
        expect(result).toEqual({ status: 'failed', reason: 'empty' });
    });

    it('fetchPaywallOfferings fails on timeout', async () => {
        const result = await fetchPaywallOfferings({
            loadPackages: () => new Promise(() => {}),
            checkEligibility: async () => ({}),
            timeoutMs: 25,
        });
        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
            expect(result.reason).toBe('timeout');
        }
    });

    it('reportPaywallLoadFailed sends PostHog and Sentry signals', async () => {
        await reportPaywallLoadFailed({
            featureKey: 'export_pdf',
            reason: 'timeout',
            detail: 'timeout',
        });
        expect(captureProductEvent).toHaveBeenCalledWith('paywall_load_failed', expect.objectContaining({
            feature_key: 'export_pdf',
            reason: 'timeout',
        }));
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'paywall_load_failed',
            expect.objectContaining({ level: 'warning' }),
        );
    });

    it('fetchPaywallOfferings returns ready state with packages and eligibility', async () => {
        const packages = {
            monthly: { identifier: 'monthly', product: { identifier: 'm', priceString: '$4' } },
            annual: null,
            tripPass: null,
        };
        const result = await fetchPaywallOfferings({
            loadPackages: async () => packages,
            checkEligibility: async () => ({ m: { status: 0 } }),
            timeoutMs: PAYWALL_OFFERINGS_LOAD_TIMEOUT_MS,
        });
        expect(result).toEqual({
            status: 'ready',
            packages,
            introEligibility: { m: { status: 0 } },
        });
    });
});
