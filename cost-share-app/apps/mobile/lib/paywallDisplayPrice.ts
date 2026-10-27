import type { PurchasesPackageLike } from './purchasesPackage.types';
import {
    STORE_PRODUCT_PRO_MONTHLY,
    STORE_PRODUCT_PRO_YEARLY,
    STORE_PRODUCT_TRIP_PASS,
} from './proConstants';

/** Sane ILS fallbacks when RevenueCat omits priceString (dev/web preview). */
export const PAYWALL_FALLBACK_PRICE_STRINGS = {
    monthly: '₪12.90',
    yearly: '₪69.90',
    tripPass: '₪19.90',
} as const;

export type PaywallPlanPriceKey = keyof typeof PAYWALL_FALLBACK_PRICE_STRINGS;

function fallbackForProductId(productId: string | undefined): string | null {
    if (!productId) return null;
    if (productId.includes('monthly')) return PAYWALL_FALLBACK_PRICE_STRINGS.monthly;
    if (productId.includes('yearly') || productId.includes('annual')) {
        return PAYWALL_FALLBACK_PRICE_STRINGS.yearly;
    }
    if (productId === STORE_PRODUCT_TRIP_PASS || productId.includes('trip_pass')) {
        return PAYWALL_FALLBACK_PRICE_STRINGS.tripPass;
    }
    if (productId === STORE_PRODUCT_PRO_MONTHLY) return PAYWALL_FALLBACK_PRICE_STRINGS.monthly;
    if (productId === STORE_PRODUCT_PRO_YEARLY) return PAYWALL_FALLBACK_PRICE_STRINGS.yearly;
    return null;
}

/** Prefer localized store priceString; never show legacy hardcoded USD placeholders. */
export function paywallDisplayPrice(
    pkg: PurchasesPackageLike | null | undefined,
    plan?: PaywallPlanPriceKey,
): string | null {
    const fromStore = pkg?.product.priceString?.trim();
    if (fromStore) return fromStore;
    return fallbackForProductId(pkg?.product.identifier) ?? (plan ? PAYWALL_FALLBACK_PRICE_STRINGS[plan] : null);
}
