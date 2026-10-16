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

export function isInQuietHoursLocal(localHour: number, startHour: number, endHour: number): boolean {
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
    return isInQuietHoursLocal(localHourInTimeZone(now, timeZone), startHour, endHour);
}

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
        if (!isInQuietHoursLocal(h, startHour, endHour)) return probe;
    }
    return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

export type PushLang = 'en' | 'he' | 'ar' | 'de' | 'es' | 'fr' | 'ru';

export function normalizePushLang(code: string | null | undefined): PushLang {
    const c = (code ?? 'en').toLowerCase();
    if (c === 'he' || c === 'iw') return 'he';
    if (c === 'ar') return 'ar';
    if (c === 'de') return 'de';
    if (c === 'es') return 'es';
    if (c === 'fr') return 'fr';
    if (c === 'ru') return 'ru';
    return 'en';
}
