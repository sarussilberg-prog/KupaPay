import {
    advanceRecurringDate,
    formatIsoDateOnly,
    parseIsoDateOnly,
    recurringLocalTodayIso,
} from '../recurringDates';

describe('recurringDates', () => {
    it('advances weekly', () => {
        const start = parseIsoDateOnly('2026-01-01');
        expect(formatIsoDateOnly(advanceRecurringDate(start, 'weekly'))).toBe('2026-01-08');
    });

    it('advances monthly with clamped day', () => {
        const start = parseIsoDateOnly('2026-01-31');
        expect(formatIsoDateOnly(advanceRecurringDate(start, 'monthly'))).toBe('2026-02-28');
    });

    it('advances yearly', () => {
        const start = parseIsoDateOnly('2024-02-29');
        expect(formatIsoDateOnly(advanceRecurringDate(start, 'yearly'))).toBe('2025-02-28');
    });

    it('recurringLocalTodayIso uses IANA timezone (Asia/Jerusalem)', () => {
        const iso = recurringLocalTodayIso(
            'Asia/Jerusalem',
            new Date('2026-03-27T21:30:00.000Z'),
        );
        expect(iso).toBe('2026-03-28');
    });
});
