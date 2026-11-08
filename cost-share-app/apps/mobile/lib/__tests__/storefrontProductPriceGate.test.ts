import {
    pickStorefrontSafePriceString,
    shouldShowTripPassPurchaseOption,
} from '@cost-share/shared';

describe('My Subscription storefront price gate', () => {
    it('hides $3.99 USD from getProducts on ISR storefront', () => {
        const result = pickStorefrontSafePriceString(
            [
                {
                    identifier: 'kupapay_pro_monthly',
                    priceString: '$3.99',
                    currencyCode: 'USD',
                },
            ],
            'ISR',
            'kupapay_pro_monthly',
        );
        expect(result.displayPriceString).toBeNull();
    });
});

describe('Trip Pass purchase gate', () => {
    it('hides standalone Trip Pass when effectiveHasPro is true without DB individualProUntil', () => {
        expect(
            shouldShowTripPassPurchaseOption({
                effectiveHasPro: true,
                subscription: null,
            }),
        ).toBe(false);
    });
});
