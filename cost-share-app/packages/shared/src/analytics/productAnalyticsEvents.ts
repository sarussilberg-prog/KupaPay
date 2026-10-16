/**
 * Canonical PostHog product event names and property keys (all platforms).
 * Privacy: no email, names, or free-text user content in analytics properties.
 */

/** Funnel events required for activation / invite / paywall dashboards (#421). */
export const PRODUCT_ANALYTICS_FUNNEL_EVENTS = [
    'signup',
    'group_created',
    'expense_added',
    'invite_sent',
    'invite_accepted',
    'settle_up',
    'paywall_view',
    'trial_start',
] as const;

export type ProductAnalyticsFunnelEvent = (typeof PRODUCT_ANALYTICS_FUNNEL_EVENTS)[number];

/** Additional explicit product events (same naming rules as funnel events). */
export const PRODUCT_ANALYTICS_EXTENDED_EVENTS = [
    'app_open',
    'paywall_load_failed',
    'purchase_completed',
    'purchase_failed',
    'purchase_started',
    'restore',
    'second_group_member_joined',
    'review_prompt_shown',
    'recurring_series_created',
    'recurring_series_stopped',
    'trip_currency_viewed',
    'smart_reminder_configured',
    'spending_insights_viewed',
    'trip_budget_configured',
    'trip_budget_viewed',
    'receipt_scan_applied',
] as const;

export type ProductAnalyticsExtendedEvent = (typeof PRODUCT_ANALYTICS_EXTENDED_EVENTS)[number];

export type ProductAnalyticsEvent =
    | ProductAnalyticsFunnelEvent
    | ProductAnalyticsExtendedEvent;

export type ProductAnalyticsPlatform = 'ios' | 'android' | 'web';

export type ProductAnalyticsPropertyValue = string | number | boolean | null;

export type ProductAnalyticsContext = {
    platform: ProductAnalyticsPlatform;
    /** Marketing app version (e.g. 2.0.0). */
    appVersion: string;
    /** BCP-47 language tag or short locale code (e.g. en, he). */
    locale: string;
};

export const PRODUCT_ANALYTICS_CONTEXT_KEYS = {
    platform: 'platform',
    appVersion: 'app_version',
    locale: 'locale',
    lib: '$lib',
} as const;

export function productAnalyticsLibTag(platform: ProductAnalyticsPlatform): string {
    return `kupapay-${platform}`;
}

export function isProductAnalyticsFunnelEvent(name: string): name is ProductAnalyticsFunnelEvent {
    return (PRODUCT_ANALYTICS_FUNNEL_EVENTS as readonly string[]).includes(name);
}

export function buildProductAnalyticsProperties(
    ctx: ProductAnalyticsContext,
    custom?: Record<string, ProductAnalyticsPropertyValue>,
): Record<string, ProductAnalyticsPropertyValue> {
    return {
        [PRODUCT_ANALYTICS_CONTEXT_KEYS.platform]: ctx.platform,
        [PRODUCT_ANALYTICS_CONTEXT_KEYS.appVersion]: ctx.appVersion,
        [PRODUCT_ANALYTICS_CONTEXT_KEYS.locale]: ctx.locale,
        [PRODUCT_ANALYTICS_CONTEXT_KEYS.lib]: productAnalyticsLibTag(ctx.platform),
        ...custom,
    };
}
