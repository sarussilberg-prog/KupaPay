import type { Language } from '../i18n/languages';
import { DEFAULT_LANGUAGE, isLanguage } from '../i18n/languages';
import type { LegalSlug } from '../types';
import { applyLegalPlaceholders } from './legalPlaceholders';
import { prependEnglishPrevailsNote } from './legalEnglishPrevailsNote';
import { legalDocumentTitle } from './legalTitles';
import { LEGAL_MARKDOWN_RAW } from './legalMarkdownBundle.generated';

export type StaticLegalDocument = {
    title: string;
    content_md: string;
    effective_date: string;
    source: 'static';
    locale: Language;
};

export function resolveLegalDocumentLocale(language: string | null | undefined): Language {
    const code = language?.split('-')[0]?.trim().toLowerCase();
    return isLanguage(code) ? code : DEFAULT_LANGUAGE;
}

/** Load bundled markdown for Terms or Privacy; falls back to English when a locale file is missing. */
export function loadStaticLegalDocument(
    slug: LegalSlug,
    locale: Language,
): StaticLegalDocument | null {
    const raw =
        LEGAL_MARKDOWN_RAW[slug][locale] ?? LEGAL_MARKDOWN_RAW[slug][DEFAULT_LANGUAGE];
    if (!raw) return null;

    const docLocale =
        LEGAL_MARKDOWN_RAW[slug][locale] != null ? locale : DEFAULT_LANGUAGE;
    const withNote = prependEnglishPrevailsNote(raw, docLocale);
    const content_md = applyLegalPlaceholders(withNote, docLocale);

    return {
        title: legalDocumentTitle(slug, docLocale),
        content_md,
        effective_date: applyLegalPlaceholders('[DATE]', docLocale),
        source: 'static',
        locale: docLocale,
    };
}
