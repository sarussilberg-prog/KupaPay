import {
    formatMoney as sharedFormatMoney,
    isLanguage,
    languageToIntlLocale,
    type FormatMoneyOptions,
} from '@cost-share/shared';
import { CURRENCY_LOCALE_NAMES } from './currencyLocaleNames';

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
    const cached = displayNamesCache.get(locale);
    if (cached) return cached;

    try {
        const displayNames = new Intl.DisplayNames([locale], { type: 'currency' });
        displayNamesCache.set(locale, displayNames);
        return displayNames;
    } catch {
        return null;
    }
}

const CURRENCY_SYMBOL_OVERRIDES: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    ILS: '₪',
    JPY: '¥',
    CHF: 'Fr',
    CAD: 'C$',
    AUD: 'A$',
    AMD: '֏',
};

function symbolFromIntl(code: string): string | null {
    try {
        const parts = new Intl.NumberFormat('en', {
            style: 'currency',
            currency: code,
            currencyDisplay: 'narrowSymbol',
        }).formatToParts(0);
        const symbol = parts.find((p) => p.type === 'currency')?.value;
        if (symbol && symbol !== code) return symbol;
    } catch {
        // invalid or unsupported ISO code in this runtime
    }
    return null;
}

export function getCurrencySymbol(code: string): string {
    return CURRENCY_SYMBOL_OVERRIDES[code] ?? symbolFromIntl(code) ?? code;
}

/** Symbol for inline amount prefix — null when the only label is the ISO code (already in the pill). */
export function getDistinctCurrencySymbol(code: string): string | null {
    const normalized = normalizeCurrencyCode(code);
    const symbol = getCurrencySymbol(normalized);
    return symbol.toUpperCase() === normalized ? null : symbol;
}

export function resolveCurrencyLocale(language: string): string {
    const code = language.split('-')[0];
    if (isLanguage(code)) {
        return languageToIntlLocale(code).split('-')[0];
    }
    if (language.startsWith('he')) return 'he';
    return 'en';
}

export function formatAmountDecimal(value: number, language?: string): string {
    const isWhole = value % 1 === 0;
    const code = language?.split('-')[0];
    const locale =
        code && isLanguage(code) ? languageToIntlLocale(code) : undefined;
    return value.toLocaleString(locale, {
        minimumFractionDigits: isWhole ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

/** Locale-aware currency amount (absolute magnitude) with bidi isolation for RTL. */
export function formatCurrencyAmount(
    value: number,
    currency: string,
    language?: string,
    options?: Pick<FormatMoneyOptions, 'bidiIsolate'>,
): string {
    return sharedFormatMoney(value, currency, {
        language,
        absolute: true,
        bidiIsolate: options?.bidiIsolate,
    });
}

export function normalizeCurrencyCode(code: string): string {
    return code.trim().toUpperCase();
}

export function getLocalizedCurrencyName(code: string, language: string): string | undefined {
    const normalizedCode = normalizeCurrencyCode(code);
    const locale = resolveCurrencyLocale(language) as keyof typeof CURRENCY_LOCALE_NAMES;
    const fromStatic = CURRENCY_LOCALE_NAMES[locale]?.[normalizedCode];
    if (fromStatic) return fromStatic;

    const displayNames = getDisplayNames(locale);
    if (!displayNames) return undefined;

    try {
        const name = displayNames.of(normalizedCode);
        return name && name !== normalizedCode ? name : undefined;
    } catch {
        return undefined;
    }
}

export function getCurrencyDisplayName(
    code: string,
    englishName: string,
    language: string,
): string {
    return getLocalizedCurrencyName(code, language) ?? englishName;
}

export function matchesCurrencySearch(
    query: string,
    code: string,
    englishName: string,
    language: string,
): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    if (normalizeCurrencyCode(code).toLowerCase().includes(normalizedQuery)) return true;
    if (englishName.toLowerCase().includes(normalizedQuery)) return true;

    const localizedName = getLocalizedCurrencyName(code, language);
    if (localizedName?.toLowerCase().includes(normalizedQuery)) return true;

    return false;
}
