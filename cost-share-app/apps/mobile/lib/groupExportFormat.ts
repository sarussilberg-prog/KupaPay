/** Locale-aware date/time formatters for group export. */

import { languageToIntlLocale, type Language } from '@cost-share/shared';
import { toDate, type DateLike } from './dateUtils';

export function formatExportDate(value: DateLike, language: Language): string {
    const locale = languageToIntlLocale(language);
    return toDate(value).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function formatExportTime(value: DateLike, language: Language): string {
    const locale = languageToIntlLocale(language);
    return toDate(value).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
    });
}
