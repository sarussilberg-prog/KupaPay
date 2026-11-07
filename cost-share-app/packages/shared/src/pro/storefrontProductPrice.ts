/** Gate StoreKit / Play price strings on the active storefront currency. */

const COUNTRY_OR_REGION_TO_CURRENCY: Record<string, string> = {
    US: 'USD',
    USA: 'USD',
    IL: 'ILS',
    ISR: 'ILS',
    GB: 'GBP',
    GBR: 'GBP',
    UK: 'GBP',
    DE: 'EUR',
    DEU: 'EUR',
    FR: 'EUR',
    FRA: 'EUR',
    ES: 'EUR',
    ESP: 'EUR',
    IT: 'EUR',
    ITA: 'EUR',
    NL: 'EUR',
    NLD: 'EUR',
    AT: 'EUR',
    AUT: 'EUR',
    BE: 'EUR',
    BEL: 'EUR',
    IE: 'EUR',
    IRL: 'EUR',
    PT: 'EUR',
    PRT: 'EUR',
    FI: 'EUR',
    FIN: 'EUR',
    CA: 'CAD',
    CAN: 'CAD',
    AU: 'AUD',
    AUS: 'AUD',
    JP: 'JPY',
    JPN: 'JPY',
    CH: 'CHF',
    CHE: 'CHF',
    SE: 'SEK',
    SWE: 'SEK',
    NO: 'NOK',
    NOR: 'NOK',
    DK: 'DKK',
    DNK: 'DKK',
    PL: 'PLN',
    POL: 'PLN',
    BR: 'BRL',
    BRA: 'BRL',
    MX: 'MXN',
    MEX: 'MXN',
    IN: 'INR',
    IND: 'INR',
    KR: 'KRW',
    KOR: 'KRW',
    SG: 'SGD',
    SGP: 'SGD',
    HK: 'HKD',
    HKG: 'HKD',
    NZ: 'NZD',
    NZL: 'NZD',
    ZA: 'ZAR',
    ZAF: 'ZAR',
    TR: 'TRY',
    TUR: 'TRY',
    RU: 'RUB',
    RUS: 'RUB',
    UA: 'UAH',
    UKR: 'UAH',
    AE: 'AED',
    ARE: 'AED',
};

export function currencyCodeForStorefrontCountry(countryCode: string | null | undefined): string | null {
    if (!countryCode?.trim()) return null;
    const key = countryCode.trim().toUpperCase();
    return COUNTRY_OR_REGION_TO_CURRENCY[key] ?? null;
}

export function storeProductPriceMatchesStorefront(
    productCurrencyCode: string | null | undefined,
    storefrontCountryCode: string | null | undefined,
): boolean {
    const product = productCurrencyCode?.trim().toUpperCase();
    if (!product) return false;
    const expected = currencyCodeForStorefrontCountry(storefrontCountryCode);
    if (!expected) return false;
    return product === expected;
}

export type StoreProductPriceRow = {
    identifier: string;
    priceString: string | null;
    currencyCode: string | null;
};

export type StorefrontSafePriceResult = {
    displayPriceString: string | null;
    storefrontCountryCode: string | null;
    storefrontCurrencyCode: string | null;
    products: StoreProductPriceRow[];
};

export function pickStorefrontSafePriceString(
    products: readonly StoreProductPriceRow[],
    storefrontCountryCode: string | null | undefined,
    preferredProductId?: string | null,
): StorefrontSafePriceResult {
    const storefrontCurrencyCode = currencyCodeForStorefrontCountry(storefrontCountryCode);
    const ordered = preferredProductId
        ? [
              ...products.filter(p => p.identifier === preferredProductId),
              ...products.filter(p => p.identifier !== preferredProductId),
          ]
        : [...products];
    for (const product of ordered) {
        const priceString = product.priceString?.trim() || null;
        if (
            priceString &&
            storeProductPriceMatchesStorefront(product.currencyCode, storefrontCountryCode)
        ) {
            return {
                displayPriceString: priceString,
                storefrontCountryCode: storefrontCountryCode?.trim() || null,
                storefrontCurrencyCode,
                products: [...products],
            };
        }
    }
    return {
        displayPriceString: null,
        storefrontCountryCode: storefrontCountryCode?.trim() || null,
        storefrontCurrencyCode,
        products: [...products],
    };
}
