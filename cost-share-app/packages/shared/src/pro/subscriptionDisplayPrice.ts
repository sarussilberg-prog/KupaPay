export type SubscriptionPricePackage = {
    product: {
        identifier: string;
        priceString?: string;
    };
};

/** Store-localized price only — no currency fallbacks (My Subscription). */
export function storeLocalizedPriceString(
    pkg: SubscriptionPricePackage | null | undefined,
): string | null {
    const fromStore = pkg?.product.priceString?.trim();
    return fromStore || null;
}

export function pickPaywallSlotPackage(
    productId: string,
    slots: {
        monthly: SubscriptionPricePackage | null;
        annual: SubscriptionPricePackage | null;
        tripPass: SubscriptionPricePackage | null;
    },
): SubscriptionPricePackage | null {
    const id = productId.toLowerCase();
    if (id.includes('monthly')) return slots.monthly;
    if (id.includes('yearly') || id.includes('annual')) return slots.annual;
    if (id.includes('trip_pass') || id.includes('trip-pass')) return slots.tripPass;
    return null;
}

export function resolveSubscriptionPriceFromOffering(
    storeProductId: string,
    offeringPackages: SubscriptionPricePackage[],
    slots: {
        monthly: SubscriptionPricePackage | null;
        annual: SubscriptionPricePackage | null;
        tripPass: SubscriptionPricePackage | null;
    },
): string | null {
    const fromOffering = offeringPackages.find(
        p =>
            p.product.identifier === storeProductId ||
            storeProductId.startsWith(`${p.product.identifier}:`) ||
            storeProductId.startsWith(`${p.product.identifier}-`),
    );
    const fromStore = storeLocalizedPriceString(fromOffering);
    if (fromStore) return fromStore;
    return storeLocalizedPriceString(pickPaywallSlotPackage(storeProductId, slots));
}
