/** Local + server Pro trial end reminder scheduling (pure logic). */

export const PRO_TRIAL_REMINDER_NOTIFICATION_ID = 'kupapay-pro-trial-reminder';

import { proTrialLengthDays } from './proSubscriptionStorePolicy';

/** When RevenueCat omits expirationDate during TRIAL, trial end = purchase + policy length. */
export function proTrialFallbackEndDaysFromPurchase(): number {
    return proTrialLengthDays();
}

export const PRO_TRIAL_REMINDER_DAYS_BEFORE_END = 2;

export type ProPeriodType = 'TRIAL' | 'INTRO' | 'NORMAL' | string | null | undefined;

export function fallbackTrialEndFromPurchase(purchasedAt: Date): Date {
    const end = new Date(purchasedAt);
    end.setUTCDate(end.getUTCDate() + proTrialFallbackEndDaysFromPurchase());
    return end;
}

export function fallbackTrialEndFromNow(now = new Date()): Date {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + proTrialLengthDays());
    return end;
}

export function resolveTrialEndDate(input: {
    periodType: ProPeriodType;
    expirationDate: string | null | undefined;
    purchasedAtMs?: number | null;
    now?: Date;
}): Date | null {
    const { periodType, expirationDate, purchasedAtMs, now = new Date() } = input;
    const inTrial = periodType === 'TRIAL' || periodType === 'INTRO';
    if (!inTrial) return null;

    if (expirationDate) {
        const parsed = new Date(expirationDate);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (purchasedAtMs != null && Number.isFinite(purchasedAtMs)) {
        return fallbackTrialEndFromPurchase(new Date(purchasedAtMs));
    }

    return fallbackTrialEndFromNow(now);
}

/** Fire at 10:00 local on the calendar day that is N days before trial end. */
export function computeTrialReminderDate(trialEnd: Date, now = new Date()): Date | null {
    const trigger = new Date(trialEnd);
    trigger.setUTCDate(trigger.getUTCDate() - PRO_TRIAL_REMINDER_DAYS_BEFORE_END);
    trigger.setUTCHours(10, 0, 0, 0);
    if (trigger.getTime() <= now.getTime()) return null;
    return trigger;
}
