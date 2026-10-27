/** Pro trial touchpoints: day 1, 10, and 13 of a 14-day trial (#406). */

export const PRO_TRIAL_LIFECYCLE_TOUCH_DAYS = [1, 10, 13] as const;
export type ProTrialLifecycleTouchDay = (typeof PRO_TRIAL_LIFECYCLE_TOUCH_DAYS)[number];

export function trialDayIndex(trialStartUtc: Date, now = new Date()): number {
    const ms = now.getTime() - trialStartUtc.getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export function dueProTrialLifecycleTouch(
    trialStartUtc: Date,
    alreadySent: readonly number[],
    now = new Date(),
): ProTrialLifecycleTouchDay | null {
    const day = trialDayIndex(trialStartUtc, now);
    for (const touch of PRO_TRIAL_LIFECYCLE_TOUCH_DAYS) {
        if (day >= touch && !alreadySent.includes(touch)) {
            return touch;
        }
    }
    return null;
}

export type ProTrialFeatureUsage = {
    receiptScan?: boolean;
    recurring?: boolean;
    smartReminder?: boolean;
    tripBudget?: boolean;
    spendingInsights?: boolean;
};

export { proTrialFeatureUsageLine, renderProTrialLifecyclePush } from './proTrialLifecycleMessages';
