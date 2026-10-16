/**
 * Feature flags driven by EXPO_PUBLIC_* env vars (no-op / safe defaults when unset).
 */

/** When true, shows Go Pro buttons and the house Pro promo interstitial in ad gates. */
export const SHOW_KUPAPAY_PRO_UPSELL =
    process.env.EXPO_PUBLIC_SHOW_KUPAPAY_PRO_UPSELL === 'true';

/** Master switch for Pro v1 (RevenueCat, paywall, perks). Default off — safe to ship. */
export const KUPAPAY_PRO_ENABLED = process.env.EXPO_PUBLIC_KUPAPAY_PRO_ENABLED === 'true';

/** Passwordless email OTP sign-in (Supabase `signInWithOtp` + 6-digit code). */
export const EMAIL_AUTH_ENABLED = process.env.EXPO_PUBLIC_ENABLE_EMAIL_AUTH === 'true';

export function isProUpsellSurfaceEnabled(): boolean {
    return KUPAPAY_PRO_ENABLED || SHOW_KUPAPAY_PRO_UPSELL;
}
