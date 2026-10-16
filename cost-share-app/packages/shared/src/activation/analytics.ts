/** PostHog funnel for activation onboarding (issue #392). */
export const ACTIVATION_ANALYTICS_EVENTS = {
    signupCompleted: 'signup_completed',
    groupCreated: 'group_created',
    firstExpenseAdded: 'first_expense_added',
} as const;

export type ActivationAnalyticsEventName =
    (typeof ACTIVATION_ANALYTICS_EVENTS)[keyof typeof ACTIVATION_ANALYTICS_EVENTS];

/** AsyncStorage keys (mobile); kept in shared for test parity. */
export const ACTIVATION_ANALYTICS_STORAGE_KEYS = {
    signupCompletedAt: '@kupapay/analytics/signup_completed_at_ms',
    signupCompletedSent: '@kupapay/analytics/signup_completed_sent',
    firstExpenseSent: '@kupapay/analytics/first_expense_sent',
} as const;

export function secondsSinceSignup(
    signupCompletedAtMs: number,
    nowMs: number = Date.now(),
): number {
    if (!Number.isFinite(signupCompletedAtMs) || signupCompletedAtMs <= 0) return 0;
    return Math.max(0, Math.round((nowMs - signupCompletedAtMs) / 1000));
}
