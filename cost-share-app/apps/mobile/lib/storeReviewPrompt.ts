/**
 * In-app review at positive moments — eligibility in @cost-share/shared.
 * Native: calls StoreKit / Play In-App Review directly (no sentiment pre-prompt).
 * Web: queues a gentle feedback sheet via AppReviewPromptHost.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import {
    APP_REVIEW_STORAGE_KEYS,
    shouldOfferAppReview,
    type AppReviewTrigger,
} from '@cost-share/shared';
import { captureProductEvent } from './productAnalytics';
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

async function requestNativeStoreReview(trigger: StoreReviewTrigger): Promise<boolean> {
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    await markAppReviewPromptConsumed();
    void captureProductEvent('review_prompt_shown', { trigger });
    return true;
}

/**
 * After a positive moment (successful settle-up or 3rd expense), prompt when eligible.
 * Never call from error paths.
 */
export async function maybePromptForAppReview(trigger: StoreReviewTrigger): Promise<boolean> {
    const state = await readEligibilityState(Date.now());
    if (!shouldOfferAppReview(trigger, state)) return false;

    if (Platform.OS === 'web') {
        useAppStore.getState().setPendingAppReview({ trigger });
        return true;
    }

    return requestNativeStoreReview(trigger);
}

/** @deprecated Use {@link maybePromptForAppReview}. */
export async function maybeQueueAppReviewPrompt(trigger: StoreReviewTrigger): Promise<boolean> {
    return maybePromptForAppReview(trigger);
}

/** @deprecated Use {@link maybePromptForAppReview}. */
export async function maybeRequestStoreReview(trigger: StoreReviewTrigger): Promise<boolean> {
    return maybePromptForAppReview(trigger);
}
