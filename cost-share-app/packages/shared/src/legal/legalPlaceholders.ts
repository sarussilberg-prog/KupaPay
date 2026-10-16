import type { Language } from '../i18n/languages';
import { OWNER_LEGAL_CONFIG } from './ownerLegalConfig';

/** Bracket tokens that must appear with the same counts in every locale (English master). */
export const LEGAL_PLACEHOLDER_TOKENS = [
    '[OWNER LEGAL NAME]',
    '[SUPPORT EMAIL]',
    '[ADDRESS]',
    '[ADDRESS — required for EU trader info]',
    '[DATE]',
    '[CITY]',
    '[16]',
] as const;

/** Hebrew EU trader line uses a localized token; counts as the EU address slot in parity checks. */
export const LEGAL_EU_ADDRESS_TOKEN_HE = '[כתובת – נדרשת לפרטי הסוחר באיחוד]';

export function countLegalPlaceholders(markdown: string): Record<(typeof LEGAL_PLACEHOLDER_TOKENS)[number], number> {
    const counts = Object.fromEntries(
        LEGAL_PLACEHOLDER_TOKENS.map((token) => [token, 0]),
    ) as Record<(typeof LEGAL_PLACEHOLDER_TOKENS)[number], number>;

    for (const token of LEGAL_PLACEHOLDER_TOKENS) {
        let idx = 0;
        while ((idx = markdown.indexOf(token, idx)) !== -1) {
            counts[token] += 1;
            idx += token.length;
        }
    }
    return counts;
}

export function countLegalSections(markdown: string): number {
    const matches = markdown.match(/^## \d+\./gm);
    return matches?.length ?? 0;
}

function addressForLocale(locale: Language): string {
    return locale === 'he' ? OWNER_LEGAL_CONFIG.addressHe : OWNER_LEGAL_CONFIG.address;
}

function cityForLocale(locale: Language): string {
    return locale === 'he' ? 'לוד' : 'Lod';
}

function buildPlaceholderMap(locale: Language): Record<string, string> {
    const address = addressForLocale(locale);
    return {
        '[OWNER LEGAL NAME]': OWNER_LEGAL_CONFIG.ownerLegalName,
        '[SUPPORT EMAIL]': OWNER_LEGAL_CONFIG.supportEmail,
        '[ADDRESS]': address,
        '[ADDRESS — required for EU trader info]': address,
        [LEGAL_EU_ADDRESS_TOKEN_HE]: address,
        '[DATE]': OWNER_LEGAL_CONFIG.lastUpdated,
        '[CITY]': cityForLocale(locale),
    };
}

/** Replace draft placeholders in legal markdown (does not strip lawyer-review banners). */
export function applyLegalPlaceholders(markdown: string, locale: Language = 'en'): string {
    const placeholders = buildPlaceholderMap(locale);
    let out = markdown;
    for (const [token, value] of Object.entries(placeholders)) {
        out = out.split(token).join(value);
    }
    return out;
}
