import type { Language } from '../i18n/languages';

/** Hour 0–23 in the user's IANA timezone. */
export function localHourInTimeZone(date: Date, timeZone: string): number {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false,
        }).formatToParts(date);
        const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
        return Number.isFinite(hour) ? hour % 24 : 0;
    } catch {
        return date.getUTCHours();
    }
}

/** Quiet window uses local hours [start, end). Supports overnight ranges (e.g. 22→8). */
export function isInQuietHoursLocal(
    localHour: number,
    startHour: number,
    endHour: number,
): boolean {
    const start = Math.max(0, Math.min(23, startHour));
    const end = Math.max(0, Math.min(23, endHour));
    if (start === end) return false;
    if (start < end) return localHour >= start && localHour < end;
    return localHour >= start || localHour < end;
}

export function isInQuietHours(
    now: Date,
    timeZone: string,
    startHour: number,
    endHour: number,
    enabled: boolean,
): boolean {
    if (!enabled) return false;
    const hour = localHourInTimeZone(now, timeZone);
    return isInQuietHoursLocal(hour, startHour, endHour);
}

/** Next UTC instant when quiet hours end (approximate: start of first allowed local hour). */
export function nextAllowedAfterQuietHours(
    now: Date,
    timeZone: string,
    startHour: number,
    endHour: number,
): Date {
    const probe = new Date(now.getTime());
    for (let i = 0; i < 49; i++) {
        probe.setTime(probe.getTime() + 60 * 60 * 1000);
        const h = localHourInTimeZone(probe, timeZone);
        if (!isInQuietHoursLocal(h, startHour, endHour)) {
            return probe;
        }
    }
    return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

export const DEFAULT_QUIET_START_HOUR = 22;
export const DEFAULT_QUIET_END_HOUR = 8;
export const DEFAULT_DAILY_PUSH_CAP = 8;
export const DEFAULT_UNSETTLED_NUDGE_DAYS = 7;
export const MIN_HOURS_BETWEEN_RETENTION_NUDGES = 72;

export type PushLocale = Language;

export function normalizePushLocale(code: string | null | undefined): PushLocale {
    const c = (code ?? 'en').toLowerCase();
    if (c === 'he' || c === 'iw') return 'he';
    if (c === 'ar') return 'ar';
    if (c === 'de') return 'de';
    if (c === 'es') return 'es';
    if (c === 'fr') return 'fr';
    if (c === 'ru') return 'ru';
    return 'en';
}
