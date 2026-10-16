import {
    computeTrialReminderDate,
    fallbackTrialEndFromPurchase,
    proTrialFallbackEndDaysFromPurchase,
    PRO_TRIAL_REMINDER_DAYS_BEFORE_END,
    resolveTrialEndDate,
} from '../proTrialReminder';

describe('resolveTrialEndDate', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');

    it('uses expirationDate when periodType is TRIAL', () => {
        const end = resolveTrialEndDate({
            periodType: 'TRIAL',
            expirationDate: '2026-10-22T12:00:00.000Z',
            now,
        });
        expect(end?.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    });

    it('returns null when not in trial', () => {
        expect(
            resolveTrialEndDate({
                periodType: 'NORMAL',
                expirationDate: '2026-10-22T12:00:00.000Z',
                now,
            }),
        ).toBeNull();
    });

    it('falls back to purchase + 14 days when TRIAL without expirationDate', () => {
        const purchasedAtMs = Date.parse('2026-10-10T00:00:00.000Z');
        const end = resolveTrialEndDate({
            periodType: 'TRIAL',
            expirationDate: null,
            purchasedAtMs,
            now,
        });
        const expected = fallbackTrialEndFromPurchase(new Date(purchasedAtMs));
        expect(end?.toISOString()).toBe(expected.toISOString());
        expect(
            (end!.getTime() - purchasedAtMs) / (24 * 60 * 60 * 1000),
        ).toBe(proTrialFallbackEndDaysFromPurchase());
    });
});

describe('computeTrialReminderDate', () => {
    it('schedules two days before trial end at 10:00 UTC', () => {
        const trialEnd = new Date('2026-10-22T18:00:00.000Z');
        const now = new Date('2026-10-15T12:00:00.000Z');
        const trigger = computeTrialReminderDate(trialEnd, now);
        expect(trigger).not.toBeNull();
        expect(trigger!.getUTCDate()).toBe(trialEnd.getUTCDate() - PRO_TRIAL_REMINDER_DAYS_BEFORE_END);
        expect(trigger!.getUTCHours()).toBe(10);
    });

    it('returns null when reminder time is in the past', () => {
        const trialEnd = new Date('2026-10-16T12:00:00.000Z');
        const now = new Date('2026-10-15T12:00:00.000Z');
        expect(computeTrialReminderDate(trialEnd, now)).toBeNull();
    });
});
