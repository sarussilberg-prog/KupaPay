import {
    shouldShowProMemberPaywall,
    shouldShowTripPassPurchaseOption,
} from '../tripPassPurchase';

describe('tripPassPurchase', () => {
    it('hides Trip Pass purchase when effectiveHasPro is true', () => {
        expect(
            shouldShowTripPassPurchaseOption({
                effectiveHasPro: true,
                subscription: null,
            }),
        ).toBe(false);
    });

    it('hides Trip Pass when admin force_pro even without subscription snapshot', () => {
        expect(
            shouldShowTripPassPurchaseOption({
                effectiveHasPro: true,
                showTripPass: true,
                subscription: { lifecycle: 'none', planKind: 'unknown' },
            }),
        ).toBe(false);
    });

    it('shows Trip Pass for free users when enabled', () => {
        expect(
            shouldShowTripPassPurchaseOption({
                effectiveHasPro: false,
                showTripPass: true,
                subscription: null,
            }),
        ).toBe(true);
    });

    it('hides Trip Pass when subscription snapshot shows active monthly', () => {
        expect(
            shouldShowTripPassPurchaseOption({
                effectiveHasPro: false,
                subscription: { lifecycle: 'active', planKind: 'monthly' },
            }),
        ).toBe(false);
    });

    it('shows member paywall when effectiveHasPro', () => {
        expect(shouldShowProMemberPaywall({ effectiveHasPro: true, subscription: null })).toBe(true);
    });
});
