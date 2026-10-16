/**
 * Product analytics (PostHog). No-ops when unset or client unbound.
 *
 * Privacy: internal user id only (no email/PII), no session replay, no IDFA/ATT,
 * explicit events only (see ProductAnalyticsEvent). Aligns with rewarded-ads compliance.
 *
 * Env: EXPO_PUBLIC_POSTHOG_KEY (legacy EXPO_PUBLIC_POSTHOG_API_KEY), EXPO_PUBLIC_POSTHOG_HOST.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ACTIVATION_ANALYTICS_EVENTS,
    ACTIVATION_ANALYTICS_STORAGE_KEYS,
    buildProductAnalyticsProperties,
    secondsSinceSignup,
    type ProductAnalyticsEvent,
    type ProductAnalyticsPropertyValue,
} from '@cost-share/shared';
import { getCurrentUserId } from './auth';
import { isPostHogConfigured } from './posthogEnv';
import { getProductAnalyticsContext } from './productAnalyticsContext';
import { supabase } from './supabase';

const FIRST_GROUP_FLAG = '@kupapay/analytics/first_group_sent';

export type { ProductAnalyticsEvent };

export type FeatureFlagValue = string | boolean | undefined;

export interface ProductAnalyticsClient {
    capture: (event: string, properties?: Record<string, unknown>) => void;
    identify: (distinctId: string, properties?: Record<string, unknown>) => void;
    reset: () => void;
    getFeatureFlag?: (key: string) => FeatureFlagValue;
    onFeatureFlags?: (callback: () => void) => () => void;
    reloadFeatureFlags?: () => void;
}

let boundClient: ProductAnalyticsClient | null = null;

/** Wired from PostHogAnalyticsProvider (or tests). */
export function setProductAnalyticsClient(client: ProductAnalyticsClient | null): void {
    boundClient = client;
}

export function getProductAnalyticsClient(): ProductAnalyticsClient | null {
    return boundClient;
}

function canCapture(): boolean {
    return isPostHogConfigured() && boundClient != null;
}

/** True when the auth user was just created (first sign-in / sign-up). */
export function isNewAccountSignup(user: {
    created_at?: string;
    last_sign_in_at?: string | null;
}): boolean {
    if (!user.created_at) return false;
    const created = Date.parse(user.created_at);
    if (Number.isNaN(created)) return false;
    const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : created;
    if (Number.isNaN(lastSignIn)) return false;
    return Math.abs(lastSignIn - created) <= 120_000;
}

/** Links events to a stable user id for retention. No PII in properties. */
export async function identifyProductUser(userId: string): Promise<void> {
    if (!canCapture()) return;
    try {
        boundClient!.identify(userId, {});
    } catch {
        // Analytics must never break user flows
    }
}

export async function resetProductAnalyticsUser(): Promise<void> {
    if (!canCapture()) return;
    try {
        boundClient!.reset();
    } catch {
        // ignore
    }
}

export async function captureProductEvent(
    event: ProductAnalyticsEvent,
    properties?: Record<string, ProductAnalyticsPropertyValue>,
): Promise<void> {
    if (!canCapture()) return;
    try {
        const uid = await getCurrentUserId();
        if (uid) {
            boundClient!.identify(uid, {});
        }
        const payload = buildProductAnalyticsProperties(getProductAnalyticsContext(), properties);
        boundClient!.capture(event, payload);
    } catch {
        // ignore
    }
}

/** Records signup time and fires `signup_completed` once per install. */
export async function trackSignupCompleted(
    properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
    try {
        const sent = await AsyncStorage.getItem(
            ACTIVATION_ANALYTICS_STORAGE_KEYS.signupCompletedSent,
        );
        if (sent === '1') return;
        const atMs = Date.now();
        await AsyncStorage.setItem(
            ACTIVATION_ANALYTICS_STORAGE_KEYS.signupCompletedAt,
            String(atMs),
        );
        await captureProductEvent(ACTIVATION_ANALYTICS_EVENTS.signupCompleted, {
            ...properties,
            signup_completed_at_ms: atMs,
        });
        await AsyncStorage.setItem(ACTIVATION_ANALYTICS_STORAGE_KEYS.signupCompletedSent, '1');
    } catch {
        // ignore
    }
}

export async function readSignupCompletedAtMs(): Promise<number | null> {
    try {
        const raw = await AsyncStorage.getItem(
            ACTIVATION_ANALYTICS_STORAGE_KEYS.signupCompletedAt,
        );
        if (!raw) return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Fires `first_expense_added` once per install with seconds since signup. */
export async function trackFirstExpenseAdded(
    groupId: string,
    extra?: Record<string, string | number | boolean | null>,
): Promise<void> {
    try {
        const sent = await AsyncStorage.getItem(ACTIVATION_ANALYTICS_STORAGE_KEYS.firstExpenseSent);
        if (sent === '1') return;
        const signupAt = await readSignupCompletedAtMs();
        const seconds =
            signupAt != null ? secondsSinceSignup(signupAt) : null;
        await captureProductEvent(ACTIVATION_ANALYTICS_EVENTS.firstExpenseAdded, {
            group_id: groupId,
            ...(seconds != null ? { seconds_since_signup: seconds } : {}),
            ...extra,
        });
        await AsyncStorage.setItem(ACTIVATION_ANALYTICS_STORAGE_KEYS.firstExpenseSent, '1');
    } catch {
        // ignore
    }
}

/** Fires `group_created` once per install/user. */
export async function trackFirstGroupCreated(groupId: string): Promise<void> {
    try {
        const sent = await AsyncStorage.getItem(FIRST_GROUP_FLAG);
        if (sent === '1') return;
        await captureProductEvent(ACTIVATION_ANALYTICS_EVENTS.groupCreated, { group_id: groupId });
        await AsyncStorage.setItem(FIRST_GROUP_FLAG, '1');
    } catch {
        // ignore
    }
}

/** Fires when a group reaches exactly two active members (viral loop metric). */
export async function trackSecondGroupMemberJoined(groupId: string): Promise<void> {
    const flagKey = `@kupapay/analytics/second_member:${groupId}`;
    try {
        if ((await AsyncStorage.getItem(flagKey)) === '1') return;

        const { count, error } = await supabase
            .from('group_members')
            .select('id', { count: 'exact', head: true })
            .eq('group_id', groupId)
            .eq('is_active', true);

        if (error || count !== 2) return;

        await captureProductEvent('second_group_member_joined', { group_id: groupId });
        await AsyncStorage.setItem(flagKey, '1');
    } catch {
        // ignore
    }
}
