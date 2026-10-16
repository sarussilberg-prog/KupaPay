import {
    shouldOfferAppReview,
    APP_REVIEW_THROTTLE_MS,
    type AppReviewEligibilityState,
} from '../eligibility';

function state(partial: Partial<AppReviewEligibilityState>): AppReviewEligibilityState {
    return {
        launchCount: 2,
        lastPromptMs: null,
        settleCount: 1,
        expenseCount: 3,
        nowMs: 1_000_000,
        ...partial,
    };
}

describe('shouldOfferAppReview', () => {
    it('never prompts on first launch', () => {
        expect(shouldOfferAppReview('first_settle_up', state({ launchCount: 1 }))).toBe(false);
    });

    it('prompts on first settle when eligible', () => {
        expect(shouldOfferAppReview('first_settle_up', state({ settleCount: 1 }))).toBe(true);
    });

    it('does not prompt on second settle', () => {
        expect(shouldOfferAppReview('first_settle_up', state({ settleCount: 2 }))).toBe(false);
    });

    it('prompts on third expense only', () => {
        expect(shouldOfferAppReview('third_expense', state({ expenseCount: 3 }))).toBe(true);
        expect(shouldOfferAppReview('third_expense', state({ expenseCount: 2 }))).toBe(false);
    });

    it('respects 90-day throttle', () => {
        expect(
            shouldOfferAppReview(
                'first_settle_up',
                state({
                    lastPromptMs: 1_000_000 - APP_REVIEW_THROTTLE_MS + 1,
                }),
            ),
        ).toBe(false);
    });
});
