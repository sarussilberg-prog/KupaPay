/**
 * Lightweight product analytics (PostHog HTTP capture). No-ops when unset.
 *
 * Owner setup:
 * - EXPO_PUBLIC_POSTHOG_API_KEY — project API key from PostHog
 * - EXPO_PUBLIC_POSTHOG_HOST (optional) — default https://us.i.posthog.com
 *
 * PostHog project settings (owner): disable session replay; do not enable
 * autocapture of text inputs on mobile (we only send explicit events below).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from './auth';
import { supabase } from './supabase';

const FIRST_GROUP_FLAG = '@kupapay/analytics/first_group_sent';

export type ProductAnalyticsEvent =
    | 'signed_in'
    | 'app_opened'
    | 'first_group_created'
    | 'expense_added'
    | 'invite_accepted'
    | 'second_group_member_joined'
    | 'settle_up_recorded'
    | 'paywall_viewed'
    | 'purchase_started'
    | 'purchase_completed'
    | 'purchase_failed'
    | 'restore';

function posthogConfig(): { key: string; host: string } | null {
    const key = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim();
    if (!key) return null;
    const hostRaw = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();
    const host = (hostRaw && hostRaw !== 'undefined' ? hostRaw : 'https://us.i.posthog.com').replace(
        /\/$/,
        '',
    );
    return { key, host };
}

async function posthogPost(body: Record<string, unknown>): Promise<void> {
    const cfg = posthogConfig();
    if (!cfg) return;
    try {
        await fetch(`${cfg.host}/capture/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: cfg.key, ...body }),
        });
    } catch {
        // Analytics must never break user flows
    }
}

async function distinctIdForCapture(): Promise<string> {
    try {
        const uid = await getCurrentUserId();
        if (uid) return uid;
    } catch {
        // ignore
    }
    return 'anonymous';
}

/** Links events to a stable user id for retention (PostHog $identify). */
export async function identifyProductUser(
    userId: string,
    traits?: { email?: string | null; language?: string | null },
): Promise<void> {
    const $set: Record<string, string> = {};
    if (traits?.email) $set.email = traits.email;
    if (traits?.language) $set.language = traits.language;

    await posthogPost({
        event: '$identify',
        distinct_id: userId,
        properties: Object.keys($set).length > 0 ? { $set } : {},
    });
}

export async function captureProductEvent(
    event: ProductAnalyticsEvent,
    properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
    const distinctId = await distinctIdForCapture();
    await posthogPost({
        event,
        distinct_id: distinctId,
        properties: {
            ...properties,
            $lib: 'kupapay-mobile',
        },
    });
}

/** Fires `first_group_created` once per install/user. */
export async function trackFirstGroupCreated(groupId: string): Promise<void> {
    try {
        const sent = await AsyncStorage.getItem(FIRST_GROUP_FLAG);
        if (sent === '1') return;
        await captureProductEvent('first_group_created', { group_id: groupId });
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
