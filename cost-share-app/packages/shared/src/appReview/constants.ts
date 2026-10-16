/** AsyncStorage keys for in-app review eligibility (mobile). */
export const APP_REVIEW_STORAGE_KEYS = {
    lastPromptMs: '@kupapay/store_review_last_prompt_ms',
    launchCount: '@kupapay/store_review_launch_count',
    settleCount: '@kupapay/store_review_settle_count',
    expenseCount: '@kupapay/store_review_expense_count',
} as const;

/** Local cap between prompts — aligns with Apple / Google guidance (~3× per year). */
export const APP_REVIEW_THROTTLE_MS = 90 * 24 * 60 * 60 * 1000;
