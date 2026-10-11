/**
 * Native App Store / Play in-app review prompt — positive moments only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { captureProductEvent } from './productAnalytics';

const LAST_PROMPT_KEY = '@kupapay/store_review_last_prompt_ms';
const LAUNCH_COUNT_KEY = '@kupapay/store_review_launch_count';
const SETTLE_COUNT_KEY = '@kupapay/store_review_settle_count';
const EXPENSE_COUNT_KEY = '@kupapay/store_review_expense_count';

export const STORE_REVIEW_THROTTLE_MS = 90 * 24 * 60 * 60 * 1000;

export type StoreReviewTrigger = 'first_settle_up' | 'third_expense';

export interface StoreReviewState {
    launchCount: number;
    lastPromptMs: number | null;
    settleCount: number;
    expenseCount: number;
    nowMs: number;
    isAvailable: boolean;
}

export function shouldOfferStoreReview(
    trigger: StoreReviewTrigger,
    state: StoreReviewState,
): boolean {
    if (!state.isAvailable) return false;
    if (state.launchCount < 2) return false;
    if (
        state.lastPromptMs != null &&
        state.nowMs - state.lastPromptMs < STORE_REVIEW_THROTTLE_MS
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

async function readState(nowMs: number, isAvailable: boolean): Promise<StoreReviewState> {
    const [launchRaw, lastRaw, settleRaw, expenseRaw] = await Promise.all([
        AsyncStorage.getItem(LAUNCH_COUNT_KEY),
        AsyncStorage.getItem(LAST_PROMPT_KEY),
        AsyncStorage.getItem(SETTLE_COUNT_KEY),
        AsyncStorage.getItem(EXPENSE_COUNT_KEY),
    ]);
    return {
        launchCount: launchRaw ? Number.parseInt(launchRaw, 10) || 0 : 0,
        lastPromptMs: lastRaw ? Number.parseInt(lastRaw, 10) : null,
        settleCount: settleRaw ? Number.parseInt(settleRaw, 10) || 0 : 0,
        expenseCount: expenseRaw ? Number.parseInt(expenseRaw, 10) || 0 : 0,
        nowMs,
        isAvailable,
    };
}

/** Call once per cold start after the app is ready (not first launch). */
export async function recordAppLaunchForStoreReview(): Promise<void> {
    const raw = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
    const n = raw ? Number.parseInt(raw, 10) || 0 : 0;
    await AsyncStorage.setItem(LAUNCH_COUNT_KEY, String(n + 1));
}

export async function incrementSettleCountForStoreReview(): Promise<number> {
    const raw = await AsyncStorage.getItem(SETTLE_COUNT_KEY);
    const n = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(SETTLE_COUNT_KEY, String(n));
    return n;
}

export async function incrementExpenseCountForStoreReview(): Promise<number> {
    const raw = await AsyncStorage.getItem(EXPENSE_COUNT_KEY);
    const n = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(EXPENSE_COUNT_KEY, String(n));
    return n;
}

export async function maybeRequestStoreReview(trigger: StoreReviewTrigger): Promise<boolean> {
    const isAvailable = await StoreReview.isAvailableAsync();
    const state = await readState(Date.now(), isAvailable);
    if (!shouldOfferStoreReview(trigger, state)) return false;

    await StoreReview.requestReview();
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(state.nowMs));
    void captureProductEvent('review_prompt_shown', { trigger });
    return true;
}
