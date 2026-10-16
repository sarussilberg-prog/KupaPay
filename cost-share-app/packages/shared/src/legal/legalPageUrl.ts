import type { Language } from '../i18n/languages';
import { legalDocumentLocale } from '../i18n/languages';
import type { LegalSlug } from '../types';

/** Public website URL for Terms or Privacy (locale via ?lang=). */
export function buildLegalPageUrl(
    webOrigin: string,
    slug: LegalSlug,
    language: Language,
): string {
    const base = webOrigin.replace(/\/$/, '');
    const lang = legalDocumentLocale(language);
    return `${base}/${slug}?lang=${lang}`;
}
