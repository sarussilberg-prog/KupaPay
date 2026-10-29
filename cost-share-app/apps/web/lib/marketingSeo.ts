import {
    APP_WEB_ORIGIN,
    languageToIntlLocale,
    SUPPORTED_LANGUAGES,
    type Language,
} from '@cost-share/shared';
import { SPLITWISE_COMPARISON_SLUG } from '@/lib/splitwiseComparisonPages';
import { USE_CASE_SLUGS, type UseCaseId } from '@/lib/useCasePages';

export const MARKETING_LOCALE_HEADER = 'x-kupapay-locale';

/** Public landing URLs: https://kupa-pay.com/{locale} */
export function marketingLandingUrl(locale: Language): string {
    return `${APP_WEB_ORIGIN}/${locale}`;
}

export function marketingLandingPath(locale: Language): string {
    return `/${locale}`;
}

export const SPLIT_CALCULATOR_SLUG = 'split-calculator';

export function splitCalculatorPath(locale: Language): string {
    return `/${locale}/${SPLIT_CALCULATOR_SLUG}`;
}

export function splitCalculatorUrl(locale: Language): string {
    return `${APP_WEB_ORIGIN}${splitCalculatorPath(locale)}`;
}

export function useCasePath(locale: Language, useCaseId: UseCaseId): string {
    return `/${locale}/${USE_CASE_SLUGS[useCaseId]}`;
}

export function useCaseUrl(locale: Language, useCaseId: UseCaseId): string {
    return `${APP_WEB_ORIGIN}${useCasePath(locale, useCaseId)}`;
}

export function buildUseCaseAlternateLanguages(useCaseId: UseCaseId): Record<string, string> {
    const languages: Record<string, string> = {
        'x-default': useCaseUrl('en', useCaseId),
    };
    for (const locale of SUPPORTED_LANGUAGES) {
        languages[hreflangForLocale(locale)] = useCaseUrl(locale, useCaseId);
    }
    return languages;
}

export function buildSplitCalculatorAlternateLanguages(): Record<string, string> {
    const languages: Record<string, string> = {
        'x-default': splitCalculatorUrl('en'),
    };
    for (const locale of SUPPORTED_LANGUAGES) {
        languages[hreflangForLocale(locale)] = splitCalculatorUrl(locale);
    }
    return languages;
}

/** Swap the locale prefix on marketing paths like `/he/split-calculator`. */
const MARKETING_LOCALE_PREFIX = /^\/([a-z]{2})(\/.*)?$/;

export function replaceLocaleInMarketingPath(pathname: string, locale: Language): string | null {
    const match = MARKETING_LOCALE_PREFIX.exec(pathname);
    if (!match) return null;
    const current = match[1];
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(current)) {
        return null;
    }
    const rest = match[2] ?? '';
    return `/${locale}${rest}`;
}

/** hreflang values (BCP 47) for alternates metadata. */
export function hreflangForLocale(locale: Language): string {
    return languageToIntlLocale(locale).split('-')[0] ?? locale;
}

export function splitwiseComparisonPath(locale: Language): string {
    return `/${locale}/${SPLITWISE_COMPARISON_SLUG}`;
}

export function splitwiseComparisonUrl(locale: Language): string {
    return `${APP_WEB_ORIGIN}${splitwiseComparisonPath(locale)}`;
}

export function buildSplitwiseComparisonAlternateLanguages(): Record<string, string> {
    const languages: Record<string, string> = {
        'x-default': splitwiseComparisonUrl('en'),
    };
    for (const locale of SUPPORTED_LANGUAGES) {
        languages[hreflangForLocale(locale)] = splitwiseComparisonUrl(locale);
    }
    return languages;
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
