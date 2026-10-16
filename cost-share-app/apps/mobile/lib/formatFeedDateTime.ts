/**
 * Locale-aware date + time for group feed bubbles.
 */

import { languageToIntlLocale, type Language } from '@cost-share/shared';
import { toDate, type DateLike } from './dateUtils';

export function formatFeedDateTime(value: DateLike, language: Language): string {
    const date = toDate(value);
    const locale = languageToIntlLocale(language);
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();

    return date.toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
        hour: '2-digit',
        minute: '2-digit',
    });
}
