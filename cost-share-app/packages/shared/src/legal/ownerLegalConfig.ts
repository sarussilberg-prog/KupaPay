/**
 * Owner / trader placeholders for Terms and Privacy.
 * Single SSOT — web legal pages and mobile paywall links use the same values.
 */
export const OWNER_LEGAL_CONFIG = {
    /** Operator name shown in Terms, Privacy, and store listings. */
    operatorDisplayName: 'Sarussilberg',
    /** Individual legally responsible (trader). */
    legalResponsibleName: 'Nave Sarussi',
    /** Replaces [OWNER LEGAL NAME] in draft markdown. */
    ownerLegalName: 'Sarussilberg',
    /** Support and privacy contact email. */
    supportEmail: 'sarussilberg@gmail.com',
    /** Public postal address (English). */
    address: 'Shlomo HaMelech 41, Lod 7136477, Israel',
    /** Public postal address (Hebrew). */
    addressHe: 'שלמה המלך 41, לוד 7136477, ישראל',
    /** ISO date string shown as "Last updated" when [DATE] appears in drafts. */
    lastUpdated: '2026-10-16',
} as const;

function addressForLocale(locale: 'en' | 'he'): string {
    return locale === 'he' ? OWNER_LEGAL_CONFIG.addressHe : OWNER_LEGAL_CONFIG.address;
}

function buildPlaceholderMap(locale: 'en' | 'he'): Record<string, string> {
    const address = addressForLocale(locale);
    return {
        '[OWNER LEGAL NAME]': OWNER_LEGAL_CONFIG.ownerLegalName,
        '[SUPPORT EMAIL]': OWNER_LEGAL_CONFIG.supportEmail,
        '[ADDRESS]': address,
        '[ADDRESS — required for EU trader info]': address,
        '[כתובת – נדרשת לפרטי הסוחר באיחוד]': address,
        '[DATE]': OWNER_LEGAL_CONFIG.lastUpdated,
    };
}

/** Replace draft placeholders in legal markdown (does not strip lawyer-review banners). */
export function applyLegalPlaceholders(markdown: string, locale: 'en' | 'he' = 'en'): string {
    const placeholders = buildPlaceholderMap(locale);
    let out = markdown;
    for (const [token, value] of Object.entries(placeholders)) {
        out = out.split(token).join(value);
    }
    return out;
}

export function legalDocumentTitle(slug: 'terms' | 'privacy', locale: 'en' | 'he'): string {
    if (slug === 'terms') return locale === 'he' ? 'תנאי שימוש' : 'Terms of Use';
    return locale === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy';
}
