import { DEFAULT_LANGUAGE, isLanguage, type Language } from '../i18n/languages';

function normalizeLang(value: string | null | undefined): Language | null {
    if (!value) return null;
    const lang = value.split('-')[0].trim().toLowerCase();
    return isLanguage(lang) ? lang : null;
}

export function parseAcceptLanguage(header: string | null | undefined): Language {
    if (!header) return DEFAULT_LANGUAGE;
    const tags = header.split(',').map((s) => s.split(';')[0]);
    for (const tag of tags) {
        const lang = normalizeLang(tag);
        if (lang) return lang;
    }
    return DEFAULT_LANGUAGE;
}

/** `?lang=` overrides Accept-Language for invite landings. */
export function resolveInviteLandingLocale(
    acceptLanguage: string | null | undefined,
    queryLang: string | null | undefined,
): Language {
    const fromQuery = normalizeLang(queryLang);
    if (fromQuery) return fromQuery;
    return parseAcceptLanguage(acceptLanguage);
}
