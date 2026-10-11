/**
 * Feature flags driven by EXPO_PUBLIC_* env vars (no-op / safe defaults when unset).
 */

/** When true, shows Go Pro buttons and the house Pro promo interstitial in ad gates. */
export const SHOW_KUPAPAY_PRO_UPSELL =
    process.env.EXPO_PUBLIC_SHOW_KUPAPAY_PRO_UPSELL === 'true';
