import {
    isInQuietHours,
    isInQuietHoursLocal,
    localHourInTimeZone,
    normalizePushLocale,
} from '../pushPolicy';

describe('pushPolicy', () => {
    it('detects overnight quiet hours', () => {
        expect(isInQuietHoursLocal(23, 22, 8)).toBe(true);
        expect(isInQuietHoursLocal(7, 22, 8)).toBe(true);
        expect(isInQuietHoursLocal(12, 22, 8)).toBe(false);
    });

    it('detects same-day quiet window', () => {
        expect(isInQuietHoursLocal(13, 12, 14)).toBe(true);
        expect(isInQuietHoursLocal(11, 12, 14)).toBe(false);
    });

    it('respects timezone for quiet hours', () => {
        const noonUtc = new Date('2026-06-15T12:00:00.000Z');
        const hourJerusalem = localHourInTimeZone(noonUtc, 'Asia/Jerusalem');
        expect(typeof hourJerusalem).toBe('number');
        expect(isInQuietHours(noonUtc, 'UTC', 22, 8, true)).toBe(false);
    });

    it('normalizes push locales', () => {
        expect(normalizePushLocale('iw')).toBe('he');
        expect(normalizePushLocale('fr')).toBe('fr');
        expect(normalizePushLocale('xx')).toBe('en');
    });
});
