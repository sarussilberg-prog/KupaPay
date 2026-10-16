import { isLanguage, languageToIntlLocale, type Language } from './languages';

/** Left-to-right isolate — keeps currency signs and digits in visual LTR inside RTL UI. */
export const BIDI_LRI = '\u2066';
/** Pop directional isolate — closes an LRI span. */
export const BIDI_PDI = '\u2069';

export function wrapMoneyForBidi(formatted: string): string {
    if (!formatted) return formatted;
    return `${BIDI_LRI}${formatted}${BIDI_PDI}`;
}

/** Keep digits, +/−, and Latin tokens in visual LTR inside RTL paragraphs (e.g. "+2"). */
export function wrapLtrForBidi(text: string): string {
    return wrapMoneyForBidi(text);
}

export type FormatMoneyOptions = {
    /** Format the absolute magnitude (no leading sign). */
    absolute?: boolean;
    /** UI language or BCP-47 tag for digit grouping and symbol placement. */
    language?: Language | string;
    /** When true (default), wrap the result in Unicode bidi isolates. */
    bidiIsolate?: boolean;
};

function resolveIntlLocale(language?: Language | string): string {
    if (!language) return 'en-US';
    const primary = String(language).split('-')[0];
    if (isLanguage(primary)) return languageToIntlLocale(primary);
    return String(language).includes('-') ? String(language) : `${primary}-${primary.toUpperCase()}`;
}

function fractionDigits(value: number): { min: number; max: number } {
    const abs = Math.abs(value);
    const isWhole = abs < 1e-9 || Math.abs(abs - Math.round(abs)) < 1e-9;
    return isWhole ? { min: 0, max: 0 } : { min: 2, max: 2 };
}

/**
 * Locale-aware money string using Intl.NumberFormat (currency narrow symbol).
 * Always bidi-isolated by default so RTL layouts do not reorder signs and symbols.
 */
export function formatMoney(
    amount: number,
    currencyCode: string,
    options?: FormatMoneyOptions,
): string {
    const currency = currencyCode.trim().toUpperCase();
    const locale = resolveIntlLocale(options?.language);
    const magnitude = options?.absolute ? Math.abs(amount) : amount;
    const { min, max } = fractionDigits(magnitude);
    const useBidi = options?.bidiIsolate !== false;

    try {
        const formatted = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: min,
            maximumFractionDigits: max,
            signDisplay: options?.absolute ? 'never' : 'auto',
        }).format(magnitude);
        return useBidi ? wrapMoneyForBidi(formatted) : formatted;
    } catch {
        const sign = !options?.absolute && magnitude < 0 ? '−' : '';
        const body = `${currency} ${Math.abs(magnitude).toFixed(max)}`;
        const fallback = `${sign}${body}`;
        return useBidi ? wrapMoneyForBidi(fallback) : fallback;
    }
}

/** @deprecated Use {@link formatMoney} — kept for older imports. */
export function formatCurrency(amount: number, currency: string, language?: Language | string): string {
    return formatMoney(amount, currency, { language, absolute: true });
}
