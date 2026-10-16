/**
 * Owner / trader placeholders for draft Terms and Privacy (TODO before publish).
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
    /** Physical address (EU trader disclosure) — TODO before publish. */
    address: '[ADDRESS]',
    /** ISO date string shown as "Last updated" when [DATE] appears in drafts. */
    lastUpdated: '2026-10-16',
} as const;

const PLACEHOLDER_MAP: Record<string, string> = {
    '[OWNER LEGAL NAME]': OWNER_LEGAL_CONFIG.ownerLegalName,
    '[SUPPORT EMAIL]': OWNER_LEGAL_CONFIG.supportEmail,
    '[ADDRESS]': OWNER_LEGAL_CONFIG.address,
    '[ADDRESS — required for EU trader info]': OWNER_LEGAL_CONFIG.address,
    '[DATE]': OWNER_LEGAL_CONFIG.lastUpdated,
};

/** Replace draft placeholders in legal markdown (does not strip lawyer-review banners). */
export function applyLegalPlaceholders(markdown: string): string {
    let out = markdown;
    for (const [token, value] of Object.entries(PLACEHOLDER_MAP)) {
        out = out.split(token).join(value);
    }
    return out;
}

export function legalDocumentTitle(slug: 'terms' | 'privacy', locale: 'en' | 'he'): string {
    if (slug === 'terms') return locale === 'he' ? 'תנאי שימוש' : 'Terms of Use';
    return locale === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy';
}
