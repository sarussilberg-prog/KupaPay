import { isLanguage, languageToIntlLocale, type Language } from '@cost-share/shared';
import { toDate, type DateLike } from './dateUtils';

/** Short calendar date in the active app language (not device OS locale). */
export function formatAppDateShort(
    value: DateLike,
    language: string,
    options?: Intl.DateTimeFormatOptions,
): string {
    const locale = isLanguage(language) ? languageToIntlLocale(language) : languageToIntlLocale('en');
    return toDate(value).toLocaleDateString(locale, options ?? { month: 'short', day: 'numeric' });
}

export function formatAppDate(value: DateLike, language: Language | string): string {
    const lang: Language = isLanguage(language) ? language : 'en';
    return formatAppDateShort(value, lang, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
