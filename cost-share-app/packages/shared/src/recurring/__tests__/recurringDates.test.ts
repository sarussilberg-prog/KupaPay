import {
    advanceRecurringDate,
    formatIsoDateOnly,
    parseIsoDateOnly,
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
});
