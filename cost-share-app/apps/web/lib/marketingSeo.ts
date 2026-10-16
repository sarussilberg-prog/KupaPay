import {
    APP_WEB_ORIGIN,
    languageToIntlLocale,
    SUPPORTED_LANGUAGES,
    type Language,
} from '@cost-share/shared';

export const MARKETING_LOCALE_HEADER = 'x-kupapay-locale';

/** Public landing URLs: https://kupa-pay.com/{locale} */
export function marketingLandingUrl(locale: Language): string {
    return `${APP_WEB_ORIGIN}/${locale}`;
}

export function marketingLandingPath(locale: Language): string {
    return `/${locale}`;
}

/** hreflang values (BCP 47) for alternates metadata. */
export function hreflangForLocale(locale: Language): string {
    return languageToIntlLocale(locale).split('-')[0] ?? locale;
}

export function buildLandingAlternateLanguages(): Record<string, string> {
    const languages: Record<string, string> = {
        'x-default': marketingLandingUrl('en'),
    };
    for (const locale of SUPPORTED_LANGUAGES) {
        languages[hreflangForLocale(locale)] = marketingLandingUrl(locale);
    }
    return languages;
}

export const APP_STORE_URL =
    'https://apps.apple.com/us/app/kupapay/id6780216665';
export const PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=com.kupapay.mobile';
