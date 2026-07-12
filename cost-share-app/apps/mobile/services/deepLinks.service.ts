/**
 * Deep Link Service — parses incoming URLs (Universal Links and the custom
 * scheme) and dispatches the appropriate redeem flow.
 *
 * Auth-callback URLs are intentionally NOT handled here; they continue to
 * flow through services/auth.service.ts.
 */

import { APP_WEB_HOST } from '@cost-share/shared';
import { NavigationProp } from '@react-navigation/native';
import { showAppToast, showInfoToast } from '../lib/appToast';
import { handleError } from '../lib/handleError';
import { QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../hooks/queries/keys';
import { useAppStore } from '../store';

export type InviteRedemptionResult =
    | { kind: 'friend' }
    | { kind: 'group'; groupId: string }
    | { kind: 'settleReminder' };

export type InviteLink =
    | { kind: 'friend'; token: string }
    | { kind: 'group'; token: string }
    | { kind: 'settleReminder'; token: string }
    | { kind: 'unknown' };

const TOKEN_RE = /^[A-Za-z0-9_-]{10}$/;

export function parseIncomingUrl(rawUrl: string): InviteLink {
    if (!rawUrl) return { kind: 'unknown' };

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { kind: 'unknown' };
    }

    // https://<APP_WEB_HOST>/i/<token> | /g/<token> | /sr/<token>
    if (parsed.protocol === 'https:' && parsed.hostname === APP_WEB_HOST) {
        const m = parsed.pathname.match(/^\/(i|g|sr)\/([^/?#]+)\/?$/);
        if (m && TOKEN_RE.test(m[2])) {
            if (m[1] === 'i') return { kind: 'friend', token: m[2] };
            if (m[1] === 'g') return { kind: 'group', token: m[2] };
            return { kind: 'settleReminder', token: m[2] };
        }
    }

    // com.kupapay.mobile://invite/i/<token> | /g/<token> | /sr/<token>
    if (parsed.protocol === 'com.kupapay.mobile:' && parsed.hostname === 'invite') {
        const m = parsed.pathname.match(/^\/(i|g|sr)\/([^/?#]+)\/?$/);
        if (m && TOKEN_RE.test(m[2])) {
            if (m[1] === 'i') return { kind: 'friend', token: m[2] };
            if (m[1] === 'g') return { kind: 'group', token: m[2] };
            return { kind: 'settleReminder', token: m[2] };
        }
    }

    return { kind: 'unknown' };
}

function navigateAfterFriendInvite(navigation: NavigationProp<any> | null): void {
    if (navigation) {
        (navigation.navigate as any)('Profile', { screen: 'Friends' });
        return;
    }
    useAppStore.getState().setPendingNavigation({ target: 'friends' });
}

function navigateAfterGroupInvite(
    navigation: NavigationProp<any> | null,
    groupId: string,
): void {
    if (navigation) {
        (navigation.navigate as any)('Groups', {
            screen: 'GroupDetail',
            params: { groupId },
        });
        return;
    }
    useAppStore.getState().setPendingNavigation({ target: 'groupDetail', groupId });
}

// Collapse concurrent redemptions of the same invite into one in-flight RPC.
// Multiple subscribers react to the same `Linking.useURL()` value — and once
// `session` flips on after sign-in, both the live-URL effect and the parked
// `pendingInvite` effect in useInviteRedemption fire together. Without this
// guard each fires its own `redeem_group_invite`, and because that RPC's
// add-member step is not atomic, the parallel calls race into a
// `group_members_group_id_user_id_key` duplicate-key violation.
const inFlightRedemptions = new Map<string, Promise<InviteRedemptionResult | null>>();

export function handleInviteLink(
    link: InviteLink,
    navigation: NavigationProp<any> | null,
    queryClient: QueryClient,
): Promise<InviteRedemptionResult | null> {
    if (link.kind === 'unknown') return Promise.resolve(null);

    const dedupeKey = `${link.kind}:${link.token}`;
    const existing = inFlightRedemptions.get(dedupeKey);
    if (existing) return existing;

    const promise = redeemInviteLink(link, navigation, queryClient).finally(() => {
        inFlightRedemptions.delete(dedupeKey);
    });
    inFlightRedemptions.set(dedupeKey, promise);
    return promise;
}

async function redeemInviteLink(
    link: Exclude<InviteLink, { kind: 'unknown' }>,
    navigation: NavigationProp<any> | null,
    queryClient: QueryClient,
): Promise<InviteRedemptionResult | null> {
    if (link.kind === 'settleReminder') {
        const { data, error } = await supabase.rpc('resolve_settle_reminder_link', { p_token: link.token });
        if (error) {
            handleRedemptionError(error, 'settleReminder');
            return null;
        }
        const payload = data as { group_id?: string; error?: string };
        if (payload.error === 'not_member') {
            showAppToast({ type: 'error', titleKey: 'remind.notGroupMember' });
            return null;
        }
        if (payload.error || !payload.group_id) {
            showAppToast({ type: 'error', titleKey: 'common.errorGeneric' });
            return null;
        }
        useAppStore.getState().setPendingNavigation({ target: 'settleUpList', groupId: payload.group_id });
        return { kind: 'settleReminder' as const };
    }

    if (link.kind === 'friend') {
        const { data, error } = await supabase.rpc('redeem_friend_invite', { p_token: link.token });
        if (error) {
            handleRedemptionError(error, 'friend');
            return null;
        }
        const payload = data as { friend_id: string; friend_name: string };
        showAppToast({
            type: 'success',
            titleKey: 'invite.redemption.friendSuccess',
            titleParams: { name: payload.friend_name },
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        navigateAfterFriendInvite(navigation);
        return { kind: 'friend' };
    }

    const { data, error } = await supabase.rpc('redeem_group_invite', { p_token: link.token });
    if (error) {
        handleRedemptionError(error, 'group');
        return null;
    }
    const payload = data as { group_id: string; group_name: string; already_member: boolean };
    showAppToast({
        type: 'success',
        titleKey: payload.already_member
            ? 'invite.redemption.alreadyMember'
            : 'invite.redemption.groupSuccess',
        titleParams: payload.already_member ? undefined : { groupName: payload.group_name },
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: ['groups'] });
    navigateAfterGroupInvite(navigation, payload.group_id);
    return { kind: 'group', groupId: payload.group_id };
}

function handleRedemptionError(error: { message: string }, kind: 'friend' | 'group' | 'settleReminder'): void {
    const message = error.message;
    // cannot_self_invite is pure UX guidance, not a bug — info toast, no Sentry.
    if (message.includes('cannot_self_invite')) {
        showInfoToast('invite.redemption.selfInvite');
        return;
    }
    if (message.includes('invite_not_found')) {
        handleError(error, {
            toast: { titleKey: 'invite.redemption.invalid' },
            tags: { service: 'deepLinks', op: 'redeem', kind, reason: 'invite_not_found' },
        });
        return;
    }
    handleError(error, {
        toast: {
            titleKey: 'common.networkError',
            messageKey: kind === 'friend' ? 'invite.friend.title' : 'invite.group.title',
        },
        tags: { service: 'deepLinks', op: 'redeem', kind },
    });
}
