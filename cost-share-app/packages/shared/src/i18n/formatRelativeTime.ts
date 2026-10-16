import { isLanguage, languageToIntlLocale, type Language } from './languages';

export type RelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

const MS: Record<RelativeTimeUnit, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
};

function resolveIntlLocale(language?: Language | string): string {
    if (!language) return 'en-US';
    const primary = String(language).split('-')[0];
    if (isLanguage(primary)) return languageToIntlLocale(primary);
    return String(language).includes('-') ? String(language) : `${primary}-${primary.toUpperCase()}`;
}

/** Pick the coarsest unit that still reads naturally for activity timestamps. */
export function pickRelativeTimeUnit(deltaMs: number): { value: number; unit: RelativeTimeUnit } {
    const abs = Math.abs(deltaMs);
    if (abs < MS.minute) return { value: Math.round(deltaMs / MS.second), unit: 'second' };
    if (abs < MS.hour) return { value: Math.round(deltaMs / MS.minute), unit: 'minute' };
    if (abs < MS.day) return { value: Math.round(deltaMs / MS.hour), unit: 'hour' };
    if (abs < MS.week) return { value: Math.round(deltaMs / MS.day), unit: 'day' };
    if (abs < MS.month) return { value: Math.round(deltaMs / MS.week), unit: 'week' };
    if (abs < MS.year) return { value: Math.round(deltaMs / MS.month), unit: 'month' };
    return { value: Math.round(deltaMs / MS.year), unit: 'year' };
}

/**
 * Short relative time label (e.g. "3 days ago") for list subtitles.
 * Returns an empty string when `when` is invalid.
 */
export function formatRelativeTimeShort(
    when: Date | string | number | null | undefined,
    nowMs: number = Date.now(),
    language?: Language | string,
): string {
    const t = when instanceof Date ? when.getTime() : new Date(when ?? 0).getTime();
    if (!Number.isFinite(t) || t <= 0) return '';
    const locale = resolveIntlLocale(language);
    const { value, unit } = pickRelativeTimeUnit(t - nowMs);
    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        return rtf.format(value, unit);
    } catch {
        return '';
    }
}
