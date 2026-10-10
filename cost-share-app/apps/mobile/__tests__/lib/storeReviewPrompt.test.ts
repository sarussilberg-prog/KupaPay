import {
    shouldOfferStoreReview,
    STORE_REVIEW_THROTTLE_MS,
    type StoreReviewState,
} from '../../lib/storeReviewPrompt';

function state(partial: Partial<StoreReviewState>): StoreReviewState {
    return {
        launchCount: 2,
        lastPromptMs: null,
        settleCount: 1,
        expenseCount: 3,
        nowMs: 1_000_000,
        isAvailable: true,
        ...partial,
    };
}

describe('shouldOfferStoreReview', () => {
    it('never prompts on first launch', () => {
        expect(
            shouldOfferStoreReview('first_settle_up', state({ launchCount: 1 })),
        ).toBe(false);
    });

    it('prompts on first settle when eligible', () => {
        expect(
            shouldOfferStoreReview('first_settle_up', state({ settleCount: 1 })),
        ).toBe(true);
    });

    it('does not prompt on second settle', () => {
        expect(
            shouldOfferStoreReview('first_settle_up', state({ settleCount: 2 })),
        ).toBe(false);
    });

    it('prompts on third expense only', () => {
        expect(
            shouldOfferStoreReview('third_expense', state({ expenseCount: 3 })),
        ).toBe(true);
        expect(
            shouldOfferStoreReview('third_expense', state({ expenseCount: 2 })),
        ).toBe(false);
    });

    it('respects 90-day throttle', () => {
        expect(
            shouldOfferStoreReview(
                'first_settle_up',
                state({
                    lastPromptMs: 1_000_000 - STORE_REVIEW_THROTTLE_MS + 1,
                }),
            ),
        ).toBe(false);
    });

    it('respects isAvailableAsync false', () => {
        expect(
            shouldOfferStoreReview('first_settle_up', state({ isAvailable: false })),
        ).toBe(false);
    });
});
