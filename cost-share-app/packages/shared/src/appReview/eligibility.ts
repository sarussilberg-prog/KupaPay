import { APP_REVIEW_THROTTLE_MS } from './constants';

export type AppReviewTrigger = 'first_settle_up' | 'third_expense';

export interface AppReviewEligibilityState {
    launchCount: number;
    lastPromptMs: number | null;
    settleCount: number;
    expenseCount: number;
    nowMs: number;
}

/**
 * Whether to show the pre-prompt after a positive moment (settle-up or 3rd expense).
 * Does not account for in-flight errors — callers must only invoke after success.
 */
export function shouldOfferAppReview(
    trigger: AppReviewTrigger,
    state: AppReviewEligibilityState,
): boolean {
    if (state.launchCount < 2) return false;
    if (
        state.lastPromptMs != null &&
        state.nowMs - state.lastPromptMs < APP_REVIEW_THROTTLE_MS
    ) {
        return false;
    }
    if (trigger === 'first_settle_up') {
        return state.settleCount === 1;
    }
    if (trigger === 'third_expense') {
        return state.expenseCount === 3;
    }
    return false;
}

/** @deprecated Use {@link shouldOfferAppReview} — kept for mobile import stability. */
export const shouldOfferStoreReview = shouldOfferAppReview;

export { APP_REVIEW_THROTTLE_MS };
