import {
    DEFAULT_LANGUAGE,
    isLanguage,
    SUPPORTED_LANGUAGES,
    type Language,
} from '@cost-share/shared';

export const LOCALE_COOKIE = 'locale';
export const ONE_YEAR_LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function normalizeMarketingLang(value: string | null | undefined): Language | null {
    if (!value) return null;
    const lang = value.split('-')[0].trim().toLowerCase();
    return isLanguage(lang) ? lang : null;
}

export function detectMarketingLocale(input: {
    cookieLocale: string | null | undefined;
    acceptLanguage: string | null | undefined;
}): Language {
    const fromCookie = normalizeMarketingLang(input.cookieLocale);
    if (fromCookie) return fromCookie;

    const accept = input.acceptLanguage;
    if (accept) {
        for (const tag of accept.split(',').map((s) => s.split(';')[0])) {
            const lang = normalizeMarketingLang(tag);
            if (lang) return lang;
        }
    }
    return DEFAULT_LANGUAGE;
}

export type MarketingMiddlewareAction =
    | { kind: 'redirect_root'; locale: Language }
    | { kind: 'continue_marketing_locale'; locale: Language }
    | { kind: 'pass_through' };

export function resolveMarketingMiddleware(
    pathname: string,
    localeInput: { cookieLocale: string | null | undefined; acceptLanguage: string | null | undefined },
): MarketingMiddlewareAction {
    if (pathname === '/') {
        return { kind: 'redirect_root', locale: detectMarketingLocale(localeInput) };
    }

    const segment = pathname.slice(1).split('/')[0];
    if (
        pathname.match(/^\/[a-z]{2}\/?$/) &&
        (SUPPORTED_LANGUAGES as readonly string[]).includes(segment)
    ) {
        return { kind: 'continue_marketing_locale', locale: segment as Language };
    }

    return { kind: 'pass_through' };
}
