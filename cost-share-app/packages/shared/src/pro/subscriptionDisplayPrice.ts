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

/** Store product ids to try with StoreKit / Play Billing getProducts (entitlement + base-plan variants). */
export function subscriptionStoreProductIdCandidates(
    storeProductId: string,
    productPlanIdentifier?: string | null,
): string[] {
    const ordered: string[] = [];
    const push = (id: string | undefined | null) => {
        const trimmed = id?.trim();
        if (trimmed && !ordered.includes(trimmed)) ordered.push(trimmed);
    };
    push(storeProductId);
    push(productPlanIdentifier);
    const base = storeProductId.split(':')[0];
    if (base) push(base);
    const afterColon = storeProductId.includes(':') ? storeProductId.split(':').slice(1).join(':') : '';
    if (afterColon) push(afterColon);
    return ordered;
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
