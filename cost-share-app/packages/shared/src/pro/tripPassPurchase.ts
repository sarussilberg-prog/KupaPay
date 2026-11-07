import type { MySubscriptionSnapshot } from './subscriptionSnapshot';
import { hasActiveIndividualSubscriptionPlan, hasActiveProSubscription } from './subscriptionSnapshot';

export type TripPassPurchaseGateInput = {
    /** Caller-controlled feature flag / route param; default true when omitted. */
    showTripPass?: boolean;
    /** Effective Pro from useProStatus (admin override + DB + store sync). */
    effectiveHasPro: boolean;
    subscription?: Pick<MySubscriptionSnapshot, 'lifecycle' | 'planKind'> | null;
};

/** Trip Pass standalone purchase is for non‑Pro users only. */
export function shouldShowTripPassPurchaseOption(input: TripPassPurchaseGateInput): boolean {
    if (input.showTripPass === false) return false;
    if (input.effectiveHasPro) return false;
    if (hasActiveIndividualSubscriptionPlan(input.subscription)) return false;
    if (hasActiveProSubscription(input.subscription as MySubscriptionSnapshot | null)) return false;
    return true;
}

/** Paywall “already Pro” panel — any active Pro access (individual, group, admin override). */
export function shouldShowProMemberPaywall(input: {
    effectiveHasPro: boolean;
    subscription?: Pick<MySubscriptionSnapshot, 'lifecycle' | 'planKind'> | null;
}): boolean {
    return input.effectiveHasPro || hasActiveProSubscription(input.subscription as MySubscriptionSnapshot | null);
}
