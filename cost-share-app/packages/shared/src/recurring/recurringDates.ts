/** Recurring expense schedule helpers (calendar dates, UTC-safe YYYY-MM-DD). */

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

const FREQ_ORDER: RecurringFrequency[] = ['weekly', 'monthly', 'yearly'];

export function isRecurringFrequency(value: string): value is RecurringFrequency {
    return (FREQ_ORDER as string[]).includes(value);
}

/** Parse YYYY-MM-DD as UTC calendar date (no local timezone drift). */
export function parseIsoDateOnly(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDateOnly(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Advance one period from a calendar date (UTC components). */
export function advanceRecurringDate(from: Date, frequency: RecurringFrequency): Date {
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth();
    const day = from.getUTCDate();
    switch (frequency) {
        case 'weekly':
            return new Date(Date.UTC(y, m, day + 7));
        case 'monthly': {
            const next = new Date(Date.UTC(y, m + 1, 1));
            const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
            return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), Math.min(day, lastDay)));
        }
        case 'yearly': {
            const lastDayFeb = new Date(Date.UTC(y + 1, m + 1, 0)).getUTCDate();
            return new Date(Date.UTC(y + 1, m, Math.min(day, lastDayFeb)));
        }
        default:
            return from;
    }
}
