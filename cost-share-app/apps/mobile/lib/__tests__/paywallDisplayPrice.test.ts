import { paywallDisplayPrice, PAYWALL_FALLBACK_PRICE_STRINGS } from '../paywallDisplayPrice';

describe('paywallDisplayPrice', () => {
    it('prefers RevenueCat localized priceString when present', () => {
        expect(
            paywallDisplayPrice({
                identifier: '$rc_monthly',
                product: { identifier: 'kupapay_pro_monthly', priceString: '₪12.90' },
            }),
        ).toBe('₪12.90');
    });

    it('falls back to ILS reference prices when priceString is missing', () => {
        expect(
            paywallDisplayPrice(
                { identifier: '$rc_monthly', product: { identifier: 'kupapay_pro_monthly', priceString: '' } },
                'monthly',
            ),
        ).toBe(PAYWALL_FALLBACK_PRICE_STRINGS.monthly);
        expect(
            paywallDisplayPrice(
                { identifier: '$rc_annual', product: { identifier: 'kupapay_pro_yearly', priceString: '  ' } },
                'yearly',
            ),
        ).toBe(PAYWALL_FALLBACK_PRICE_STRINGS.yearly);
        expect(
            paywallDisplayPrice(
                { identifier: 'trip_pass', product: { identifier: 'kupapay_trip_pass', priceString: '' } },
                'tripPass',
            ),
        ).toBe(PAYWALL_FALLBACK_PRICE_STRINGS.tripPass);
    });
});
