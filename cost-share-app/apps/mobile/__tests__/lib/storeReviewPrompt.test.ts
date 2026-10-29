import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { maybePromptForAppReview } from '../../lib/storeReviewPrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../store';
import { APP_REVIEW_STORAGE_KEYS } from '@cost-share/shared';
import { captureProductEvent } from '../../lib/productAnalytics';

jest.mock('expo-store-review', () => ({
    isAvailableAsync: jest.fn(async () => true),
    requestReview: jest.fn(async () => {}),
}));

jest.mock('../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(async () => {}),
}));

describe('maybePromptForAppReview', () => {
    const originalOs = Platform.OS;

    beforeEach(async () => {
        jest.clearAllMocks();
        useAppStore.setState({ pendingAppReview: null });
        await AsyncStorage.multiRemove(Object.values(APP_REVIEW_STORAGE_KEYS));
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    });

    it('calls native in-app review on iOS when eligible', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        await AsyncStorage.multiSet([
            [APP_REVIEW_STORAGE_KEYS.launchCount, '2'],
            [APP_REVIEW_STORAGE_KEYS.settleCount, '1'],
        ]);
        const prompted = await maybePromptForAppReview('first_settle_up');
        expect(prompted).toBe(true);
        expect(StoreReview.requestReview).toHaveBeenCalled();
        expect(captureProductEvent).toHaveBeenCalledWith('review_prompt_shown', {
            trigger: 'first_settle_up',
        });
        expect(useAppStore.getState().pendingAppReview).toBeNull();
    });

    it('queues web feedback sheet when eligible on web', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        await AsyncStorage.multiSet([
            [APP_REVIEW_STORAGE_KEYS.launchCount, '2'],
            [APP_REVIEW_STORAGE_KEYS.settleCount, '1'],
        ]);
        const prompted = await maybePromptForAppReview('first_settle_up');
        expect(prompted).toBe(true);
        expect(StoreReview.requestReview).not.toHaveBeenCalled();
        expect(useAppStore.getState().pendingAppReview).toEqual({ trigger: 'first_settle_up' });
    });

    it('does not prompt when throttled', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        await AsyncStorage.multiSet([
            [APP_REVIEW_STORAGE_KEYS.launchCount, '5'],
            [APP_REVIEW_STORAGE_KEYS.settleCount, '1'],
            [APP_REVIEW_STORAGE_KEYS.lastPromptMs, String(Date.now())],
        ]);
        const prompted = await maybePromptForAppReview('first_settle_up');
        expect(prompted).toBe(false);
        expect(StoreReview.requestReview).not.toHaveBeenCalled();
    });
});
