/**
 * Web stub — RevenueCat / react-native-purchases is native-only (App Store / Play).
 * Pro IAP is not offered on Expo web; paywall shows store-not-configured.
 */

import type { PaywallPackages, PurchasesPackageLike } from '../lib/purchasesPackage.types';
import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';

export type { PaywallPackages, PurchasesPackageLike };

function captureMode(): boolean {
    if (process.env.EXPO_PUBLIC_ASC_SCREENSHOT_DEMO === 'true') return true;
    if (typeof globalThis.location !== 'undefined') {
        const p = new URLSearchParams(globalThis.location.search);
        return p.get('capture') === '1' || p.has('screen');
    }
    return false;
}

const CAPTURE = captureMode();

/** Web can display paywall pricing (RevenueCat is native-only); purchases still no-op. */
export function isPurchasesConfigured(): boolean {
    return CAPTURE || KUPAPAY_PRO_ENABLED;
}

export async function configurePurchasesForUser(_userId: string): Promise<void> {}

export async function waitForPurchasesReady(): Promise<boolean> {
    return false;
}

export async function fetchPurchasesCustomerInfo(): Promise<null> {
    return null;
}

export async function logOutPurchases(): Promise<void> {}

function capturePackages(): PaywallPackages {
    const introTwoWeeks = {
        price: 0,
        priceString: '₪0.00',
        periodNumberOfUnits: 2,
        periodUnit: 'WEEK',
    };
    const mk = (id: string, price: string, withTrial: boolean): PurchasesPackageLike => ({
        identifier: id,
        product: {
            identifier: id,
            priceString: price,
            introPrice: withTrial ? introTwoWeeks : undefined,
        },
    });
    return {
        monthly: mk('kupapay_pro_monthly', '₪12.90', true),
        annual: mk('kupapay_pro_yearly', '₪69.90', true),
        tripPass: mk('kupapay_trip_pass', '₪19.90', false),
    };
}

export async function loadOfferingPackages(): Promise<PaywallPackages> {
    if (CAPTURE || KUPAPAY_PRO_ENABLED) return capturePackages();
    return { monthly: null, annual: null, tripPass: null };
}

export async function checkIntroductoryPriceEligibility(): Promise<
    Record<string, { status: number }>
> {
    if (CAPTURE || KUPAPAY_PRO_ENABLED) {
        return {
            kupapay_pro_monthly: { status: 2 },
            kupapay_pro_yearly: { status: 2 },
        };
    }
    return {};
}

export async function fetchProSubscriptionUiState(): Promise<{
    isInFreeTrial: boolean;
    trialEndsAt: string | null;
    manageSubscriptionsAvailable: boolean;
    trialLifecycleSent?: number[];
    trialFeatureUsage?: Record<string, boolean>;
}> {
    if (!KUPAPAY_PRO_ENABLED) {
        return { isInFreeTrial: false, trialEndsAt: null, manageSubscriptionsAvailable: false };
    }
    const { supabase } = await import('../lib/supabase');
    const { getCurrentUserId } = await import('../lib/auth');
    const userId = await getCurrentUserId();
    if (!userId) {
        return { isInFreeTrial: false, trialEndsAt: null, manageSubscriptionsAvailable: false };
    }
    const { data: profileRow } = await supabase
        .from('profiles')
        .select('pro_trial_ends_at, pro_trial_lifecycle_sent, pro_trial_feature_usage')
        .eq('id', userId)
        .maybeSingle();
    const trialEndsAt = profileRow?.pro_trial_ends_at ?? null;
    const inTrial = trialEndsAt != null && Date.parse(trialEndsAt) > Date.now();
    let trialLifecycleSent: number[] = [];
    const sentRaw = profileRow?.pro_trial_lifecycle_sent;
    if (Array.isArray(sentRaw)) {
        trialLifecycleSent = sentRaw.map(v => Number(v)).filter(n => Number.isFinite(n));
    }
    let trialFeatureUsage: Record<string, boolean> = {};
    if (profileRow?.pro_trial_feature_usage && typeof profileRow.pro_trial_feature_usage === 'object') {
        trialFeatureUsage = profileRow.pro_trial_feature_usage as Record<string, boolean>;
    }
    return {
        isInFreeTrial: inTrial,
        trialEndsAt: inTrial ? trialEndsAt : null,
        manageSubscriptionsAvailable: false,
        trialLifecycleSent,
        trialFeatureUsage,
    };
}

export async function syncProTrialNudgeToRevenueCat(_touchDay: number, _event: 'shown' | 'dismissed'): Promise<void> {}

export async function purchasePackage(
    _pkg: PurchasesPackageLike,
    _opts: { featureKey: string; groupId?: string },
): Promise<{ ok: true } | { ok: false; userCancelled?: boolean }> {
    return { ok: false };
}

export async function restorePurchases(_featureKey: string, _groupId?: string): Promise<boolean> {
    return false;
}

export async function openSubscriptionManagement(): Promise<void> {}

export async function presentOfferCodeRedemption(): Promise<void> {}
