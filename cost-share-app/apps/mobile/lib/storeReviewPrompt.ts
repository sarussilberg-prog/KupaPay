/**
 * In-app review orchestration — eligibility in @cost-share/shared; UI in AppReviewPromptHost.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    APP_REVIEW_STORAGE_KEYS,
    shouldOfferAppReview,
    type AppReviewTrigger,
} from '@cost-share/shared';
import { useAppStore } from '../store';

export type StoreReviewTrigger = AppReviewTrigger;

export {
    shouldOfferAppReview,
    shouldOfferAppReview as shouldOfferStoreReview,
    APP_REVIEW_THROTTLE_MS,
    APP_REVIEW_THROTTLE_MS as STORE_REVIEW_THROTTLE_MS,
} from '@cost-share/shared';

export type { AppReviewEligibilityState as StoreReviewState } from '@cost-share/shared';

async function readEligibilityState(nowMs: number) {
    const [launchRaw, lastRaw, settleRaw, expenseRaw] = await Promise.all([
        AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.launchCount),
        AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.lastPromptMs),
        AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.settleCount),
        AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.expenseCount),
    ]);
    return {
        launchCount: launchRaw ? Number.parseInt(launchRaw, 10) || 0 : 0,
        lastPromptMs: lastRaw ? Number.parseInt(lastRaw, 10) : null,
        settleCount: settleRaw ? Number.parseInt(settleRaw, 10) || 0 : 0,
        expenseCount: expenseRaw ? Number.parseInt(expenseRaw, 10) || 0 : 0,
        nowMs,
    };
}

/** Call once per cold start after the app is ready (not first launch). */
export async function recordAppLaunchForStoreReview(): Promise<void> {
    const raw = await AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.launchCount);
    const n = raw ? Number.parseInt(raw, 10) || 0 : 0;
    await AsyncStorage.setItem(APP_REVIEW_STORAGE_KEYS.launchCount, String(n + 1));
}

export async function incrementSettleCountForStoreReview(): Promise<number> {
    const raw = await AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.settleCount);
    const n = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(APP_REVIEW_STORAGE_KEYS.settleCount, String(n));
    return n;
}

export async function incrementExpenseCountForStoreReview(): Promise<number> {
    const raw = await AsyncStorage.getItem(APP_REVIEW_STORAGE_KEYS.expenseCount);
    const n = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(APP_REVIEW_STORAGE_KEYS.expenseCount, String(n));
    return n;
}

export async function markAppReviewPromptConsumed(nowMs = Date.now()): Promise<void> {
    await AsyncStorage.setItem(APP_REVIEW_STORAGE_KEYS.lastPromptMs, String(nowMs));
}

/** Queues the pre-prompt when eligibility passes (native or web feedback). */
export async function maybeQueueAppReviewPrompt(trigger: StoreReviewTrigger): Promise<boolean> {
    const state = await readEligibilityState(Date.now());
    if (!shouldOfferAppReview(trigger, state)) return false;

    useAppStore.getState().setPendingAppReview({ trigger });
    return true;
}

/** @deprecated Use {@link maybeQueueAppReviewPrompt}. */
export async function maybeRequestStoreReview(trigger: StoreReviewTrigger): Promise<boolean> {
    return maybeQueueAppReviewPrompt(trigger);
}
