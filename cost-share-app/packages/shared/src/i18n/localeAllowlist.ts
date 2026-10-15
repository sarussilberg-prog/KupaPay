/**
 * Values that may legitimately match English across non-EN locale files.
 */

/** Exact string values allowed to equal English (brands, acronyms, etc.). */
export const LOCALE_VALUE_ALLOWLIST_EXACT = new Set([
    'KupaPay',
    'OK',
    'Pro',
    'Venmo',
    'PayPal',
    'Google',
    'Apple',
    'Supabase',
    'WhatsApp',
    'USD',
    'EUR',
    'GBP',
    'ILS',
    'JPY',
    'AdMob',
    'RevenueCat',
    'Sentry',
    'PostHog',
    'API',
    'CSV',
    'PDF',
    'FAQ',
    'RTL',
    'LTR',
    'ID',
    'iOS',
    'Android',
    'Airbnb',
    'Bit',
    'PayBox',
]);

/** If the entire string matches, allow (e.g. "KupaPay Pro"). */
const ALLOWLIST_PATTERNS: RegExp[] = [
    /^[\d\s.,+\-–—/|:;%$€£₪¥()]+$/,
    /^https?:\/\//,
    /^v[\d.]+$/,
    /^©\s*\d{4}\s*KupaPay$/,
    /^@\s*\{\{rate\}\}$/,
    /^0[.,]00$/,
];

/** Keys where the English UI token is intentionally reused (mock names, ISO labels). */
/** UI tokens that are valid translations but spell the same as English. */
const ALLOWLIST_KEY_VALUE: Readonly<Record<string, ReadonlySet<string>>> = {
    'common.no': new Set(['No']),
};

const ALLOWLIST_KEYS = new Set([
    'onboarding.mockup.invite1Title',
    'onboarding.mockup.invite2Title',
    'onboarding.mockup.debt1Title',
    'onboarding.mockup.debt2Title',
    'onboarding.mockup.card1Title',
    'onboarding.mockup.card2Title',
]);

export function isAllowlistedLocaleValue(value: string, key?: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (key && ALLOWLIST_KEYS.has(key)) return true;
    if (key && ALLOWLIST_KEY_VALUE[key]?.has(trimmed)) return true;
    if (LOCALE_VALUE_ALLOWLIST_EXACT.has(trimmed)) return true;
    if (ALLOWLIST_PATTERNS.some((re) => re.test(trimmed))) return true;
    // Product name embedded in short strings
    if (trimmed.includes('KupaPay') && trimmed.length <= 80) return true;
    return false;
}
