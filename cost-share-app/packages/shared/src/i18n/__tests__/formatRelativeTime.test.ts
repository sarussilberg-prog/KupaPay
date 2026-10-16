import { formatRelativeTimeShort, pickRelativeTimeUnit } from '../formatRelativeTime';

describe('pickRelativeTimeUnit', () => {
    it('uses negative values for past timestamps (Intl past tense)', () => {
        const sixDaysMs = 6 * 86_400_000;
        expect(pickRelativeTimeUnit(-sixDaysMs)).toEqual({ value: -6, unit: 'day' });
    });

    it('uses positive values for future timestamps', () => {
        const sixDaysMs = 6 * 86_400_000;
        expect(pickRelativeTimeUnit(sixDaysMs)).toEqual({ value: 6, unit: 'day' });
    });
});

describe('formatRelativeTimeShort', () => {
    const now = Date.UTC(2026, 9, 16, 12, 0, 0);

    it('formats past activity in English', () => {
        const when = new Date(now - 6 * 86_400_000);
        const label = formatRelativeTimeShort(when, now, 'en');
        expect(label).toMatch(/6 days ago/i);
        expect(label).not.toMatch(/in 6 days/i);
    });

    it('formats past activity in Hebrew with לפני (not future בעוד)', () => {
        const when = new Date(now - 6 * 86_400_000);
        const label = formatRelativeTimeShort(when, now, 'he');
        expect(label).toContain('לפני');
        expect(label).not.toContain('בעוד');
    });

    it('returns empty string for invalid dates', () => {
        expect(formatRelativeTimeShort(null, now, 'en')).toBe('');
    });
});
