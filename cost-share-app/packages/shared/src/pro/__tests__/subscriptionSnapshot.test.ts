import {
    buildSubscriptionSnapshot,
    deriveSubscriptionLifecycle,
    hasActiveProSubscription,
    mapStoreKind,
} from '../subscriptionSnapshot';

describe('subscriptionSnapshot', () => {
    it('maps store kinds', () => {
        expect(mapStoreKind('APP_STORE')).toBe('app_store');
        expect(mapStoreKind('PLAY_STORE')).toBe('play_store');
    });

    it('derives billing and cancelled states', () => {
        expect(
            deriveSubscriptionLifecycle(
                {
                    isActive: true,
                    willRenew: true,
                    expirationDate: '2027-01-01T00:00:00.000Z',
                    productIdentifier: 'kupapay_pro_monthly',
                    billingIssueDetectedAt: '2026-06-01T00:00:00.000Z',
                },
                null,
            ),
        ).toBe('billing_issue');
        expect(
            deriveSubscriptionLifecycle(
                {
                    isActive: true,
                    willRenew: false,
                    expirationDate: '2027-01-01T00:00:00.000Z',
                    productIdentifier: 'kupapay_pro_yearly',
                },
                null,
            ),
        ).toBe('cancelled_until_expiry');
        expect(
            deriveSubscriptionLifecycle(
                {
                    isActive: true,
                    willRenew: true,
                    expirationDate: '2027-01-01T00:00:00.000Z',
                    productIdentifier: 'kupapay_pro_monthly',
                    unsubscribeDetectedAt: '2026-10-01T00:00:00.000Z',
                },
                null,
            ),
        ).toBe('cancelled_until_expiry');
    });

    it('falls back to server pro_until when RC entitlement inactive', () => {
        const now = new Date('2026-06-01T12:00:00.000Z');
        expect(
            deriveSubscriptionLifecycle(null, '2026-12-01T00:00:00.000Z', now),
        ).toBe('active');
    });

    it('builds snapshot with trip pass lines', () => {
        const snap = buildSubscriptionSnapshot({
            entitlement: {
                isActive: true,
                willRenew: true,
                expirationDate: '2027-01-15T00:00:00.000Z',
                productIdentifier: 'kupapay_pro_yearly',
                store: 'APP_STORE',
            },
            priceString: '₪69.90',
            serverIndividualUntil: '2027-01-15T00:00:00.000Z',
            tripPasses: [
                { groupId: 'g1', groupName: 'Barcelona', expiresAt: '2026-12-20T00:00:00.000Z' },
            ],
        });
        expect(snap.lifecycle).toBe('active');
        expect(snap.planKind).toBe('yearly');
        expect(snap.tripPasses).toHaveLength(1);
    });

    it('marks cancelled until expiry when unsubscribe is detected', () => {
        const snap = buildSubscriptionSnapshot({
            entitlement: {
                isActive: true,
                willRenew: true,
                expirationDate: '2027-01-15T00:00:00.000Z',
                productIdentifier: 'kupapay_pro_monthly',
                unsubscribeDetectedAt: '2026-11-01T00:00:00.000Z',
            },
            priceString: '₪12.90',
            serverIndividualUntil: '2027-01-15T00:00:00.000Z',
            tripPasses: [],
        });
        expect(snap.lifecycle).toBe('cancelled_until_expiry');
        expect(snap.autoRenew).toBe(false);
    });

    it('does not treat missing willRenew as auto-renew on', () => {
        const snap = buildSubscriptionSnapshot({
            entitlement: {
                isActive: true,
                willRenew: undefined as unknown as boolean,
                expirationDate: '2027-01-15T00:00:00.000Z',
                productIdentifier: 'kupapay_pro_monthly',
            },
            priceString: null,
            serverIndividualUntil: null,
            tripPasses: [],
        });
        expect(snap.autoRenew).toBe(false);
    });

    it('hasActiveProSubscription is true for active, grace, and billing issue', () => {
        expect(hasActiveProSubscription({ lifecycle: 'active' } as never)).toBe(true);
        expect(hasActiveProSubscription({ lifecycle: 'cancelled_until_expiry' } as never)).toBe(
            true,
        );
        expect(hasActiveProSubscription({ lifecycle: 'billing_issue' } as never)).toBe(true);
        expect(hasActiveProSubscription({ lifecycle: 'expired' } as never)).toBe(false);
        expect(hasActiveProSubscription(null)).toBe(false);
    });
});
