import {
    currencyCodeForStorefrontCountry,
    pickStorefrontSafePriceString,
    storeProductPriceMatchesStorefront,
} from '../storefrontProductPrice';

describe('storefrontProductPrice', () => {
    it('maps Israeli storefront to ILS', () => {
        expect(currencyCodeForStorefrontCountry('ISR')).toBe('ILS');
        expect(currencyCodeForStorefrontCountry('IL')).toBe('ILS');
    });

    it('rejects USD price on Israeli storefront', () => {
        expect(storeProductPriceMatchesStorefront('USD', 'ISR')).toBe(false);
        expect(storeProductPriceMatchesStorefront('ILS', 'ISR')).toBe(true);
    });

    it('returns null display when currency mismatches storefront', () => {
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
        expect(result.products).toHaveLength(1);
    });

    it('returns localized price when currency matches storefront', () => {
        const result = pickStorefrontSafePriceString(
            [
                {
                    identifier: 'kupapay_pro_monthly',
                    priceString: '₪12.90',
                    currencyCode: 'ILS',
                },
            ],
            'ISR',
            'kupapay_pro_monthly',
        );
        expect(result.displayPriceString).toBe('₪12.90');
    });
});
