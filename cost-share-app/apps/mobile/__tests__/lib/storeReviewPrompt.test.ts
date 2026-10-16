import {
    shouldOfferStoreReview,
    STORE_REVIEW_THROTTLE_MS,
    maybeQueueAppReviewPrompt,
    type StoreReviewState,
} from '../../lib/storeReviewPrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../store';
import { APP_REVIEW_STORAGE_KEYS } from '@cost-share/shared';

function state(partial: Partial<StoreReviewState>): StoreReviewState {
    return {
        launchCount: 2,
        lastPromptMs: null,
        settleCount: 1,
        expenseCount: 3,
        nowMs: 1_000_000,
        ...partial,
    };
}

describe('shouldOfferStoreReview', () => {
    it('never prompts on first launch', () => {
        expect(shouldOfferStoreReview('first_settle_up', state({ launchCount: 1 }))).toBe(false);
    });

    it('prompts on first settle when eligible', () => {
        expect(shouldOfferStoreReview('first_settle_up', state({ settleCount: 1 }))).toBe(true);
    });

    it('does not prompt on second settle', () => {
        expect(shouldOfferStoreReview('first_settle_up', state({ settleCount: 2 }))).toBe(false);
    });

    it('prompts on third expense only', () => {
        expect(shouldOfferStoreReview('third_expense', state({ expenseCount: 3 }))).toBe(true);
        expect(shouldOfferStoreReview('third_expense', state({ expenseCount: 2 }))).toBe(false);
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
});

describe('maybeQueueAppReviewPrompt', () => {
    beforeEach(async () => {
        useAppStore.setState({ pendingAppReview: null });
        await AsyncStorage.multiRemove(Object.values(APP_REVIEW_STORAGE_KEYS));
    });

    it('queues pendingAppReview when eligible', async () => {
        await AsyncStorage.multiSet([
            [APP_REVIEW_STORAGE_KEYS.launchCount, '2'],
            [APP_REVIEW_STORAGE_KEYS.settleCount, '1'],
        ]);
        const queued = await maybeQueueAppReviewPrompt('first_settle_up');
        expect(queued).toBe(true);
        expect(useAppStore.getState().pendingAppReview).toEqual({ trigger: 'first_settle_up' });
    });

    it('does not queue when throttled', async () => {
        await AsyncStorage.multiSet([
            [APP_REVIEW_STORAGE_KEYS.launchCount, '5'],
            [APP_REVIEW_STORAGE_KEYS.settleCount, '1'],
            [APP_REVIEW_STORAGE_KEYS.lastPromptMs, String(Date.now())],
        ]);
        const queued = await maybeQueueAppReviewPrompt('first_settle_up');
        expect(queued).toBe(false);
        expect(useAppStore.getState().pendingAppReview).toBeNull();
    });
});
