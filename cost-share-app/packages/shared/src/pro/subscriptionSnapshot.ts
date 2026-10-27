/** Store-agnostic subscription lifecycle for My Subscription UI. */

export type SubscriptionStoreKind =
    | 'app_store'
    | 'play_store'
    | 'promotional'
    | 'stripe'
    | 'unknown';

export type SubscriptionLifecycle =
    | 'active'
    | 'cancelled_until_expiry'
    | 'billing_issue'
    | 'expired'
    | 'none';

export type SubscriptionPlanKind = 'monthly' | 'yearly' | 'trip_pass' | 'unknown';

export interface EntitlementWireSlice {
    isActive: boolean;
    willRenew: boolean;
    expirationDate: string | null;
    productIdentifier: string;
    productPlanIdentifier?: string | null;
    store?: string | null;
    periodType?: string | null;
    unsubscribeDetectedAt?: string | null;
    billingIssueDetectedAt?: string | null;
}

export interface TripPassLine {
    groupId: string;
    groupName: string;
    expiresAt: string;
}

export interface MySubscriptionSnapshot {
    lifecycle: SubscriptionLifecycle;
    planKind: SubscriptionPlanKind;
    priceString: string | null;
    renewalOrExpiryIso: string | null;
    autoRenew: boolean | null;
    store: SubscriptionStoreKind;
    storeProductId: string | null;
    storePlanId: string | null;
    isFreeTrial: boolean;
    tripPasses: TripPassLine[];
    serverIndividualUntil: string | null;
}

function planKindFromProductId(productId: string): SubscriptionPlanKind {
    const id = productId.toLowerCase();
    if (id.includes('trip_pass') || id.includes('trip-pass')) return 'trip_pass';
    if (id.includes('yearly') || id.includes('annual')) return 'yearly';
    if (id.includes('monthly')) return 'monthly';
    return 'unknown';
}

export function mapStoreKind(store: string | null | undefined): SubscriptionStoreKind {
    switch (store) {
        case 'APP_STORE':
        case 'MAC_APP_STORE':
            return 'app_store';
        case 'PLAY_STORE':
            return 'play_store';
        case 'PROMOTIONAL':
            return 'promotional';
        case 'STRIPE':
            return 'stripe';
        default:
            return 'unknown';
    }
}

export function deriveSubscriptionLifecycle(
    ent: EntitlementWireSlice | null | undefined,
    serverIndividualUntil: string | null | undefined,
    now: Date = new Date(),
): SubscriptionLifecycle {
    const nowMs = now.getTime();
    if (ent?.isActive) {
        if (ent.billingIssueDetectedAt) return 'billing_issue';
        if (ent.willRenew === false) return 'cancelled_until_expiry';
        return 'active';
    }
    if (ent && !ent.isActive) return 'expired';
    if (serverIndividualUntil) {
        const ms = new Date(serverIndividualUntil).getTime();
        if (Number.isFinite(ms) && ms > nowMs) return 'active';
    }
    return 'none';
}

export function buildSubscriptionSnapshot(input: {
    entitlement: EntitlementWireSlice | null;
    priceString: string | null;
    serverIndividualUntil: string | null;
    tripPasses: TripPassLine[];
    now?: Date;
}): MySubscriptionSnapshot {
    const ent = input.entitlement;
    const lifecycle = deriveSubscriptionLifecycle(ent, input.serverIndividualUntil, input.now);
    const periodType = ent?.periodType ?? null;
    const isFreeTrial = periodType === 'TRIAL' || periodType === 'INTRO';

    return {
        lifecycle,
        planKind: ent?.productIdentifier ? planKindFromProductId(ent.productIdentifier) : 'unknown',
        priceString: input.priceString,
        renewalOrExpiryIso:
            ent?.expirationDate ??
            input.serverIndividualUntil ??
            input.tripPasses[0]?.expiresAt ??
            null,
        autoRenew: ent?.isActive ? ent.willRenew : null,
        store: mapStoreKind(ent?.store),
        storeProductId: ent?.productIdentifier ?? null,
        storePlanId: ent?.productPlanIdentifier ?? null,
        isFreeTrial,
        tripPasses: input.tripPasses,
        serverIndividualUntil: input.serverIndividualUntil,
    };
}
