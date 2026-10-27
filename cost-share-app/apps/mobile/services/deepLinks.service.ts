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
import { captureProductEvent, trackSecondGroupMemberJoined } from '../lib/productAnalytics';
import { parseRpcResult } from '../lib/rpcResult';
import { listClaimableGuestMembers } from './groups.service';
import { INVITE_TOKEN_RE } from '../lib/inviteToken';

export type InviteRedemptionResult =
    | { kind: 'friend' }
    | { kind: 'group'; groupId: string }
    | { kind: 'settleReminder' }
    | { kind: 'expenseShare' };

export type InviteLink =
    | { kind: 'friend'; token: string }
    | { kind: 'group'; token: string }
    | { kind: 'expenseShare'; token: string }
    | { kind: 'settleReminder'; token: string }
    | { kind: 'unknown' };

function inviteLinkFromPathname(pathname: string): InviteLink | null {
    const m = pathname.match(/^\/(i|g|sr|e)\/([^/?#]+)\/?$/);
    if (!m || !INVITE_TOKEN_RE.test(m[2])) return null;
    if (m[1] === 'i') return { kind: 'friend', token: m[2] };
    if (m[1] === 'g') return { kind: 'group', token: m[2] };
    if (m[1] === 'e') return { kind: 'expenseShare', token: m[2] };
    return { kind: 'settleReminder', token: m[2] };
}

export function parseIncomingUrl(rawUrl: string): InviteLink {
    if (!rawUrl) return { kind: 'unknown' };

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { kind: 'unknown' };
    }

    if (parsed.protocol === 'https:' && parsed.hostname === APP_WEB_HOST) {
        const link = inviteLinkFromPathname(parsed.pathname);
        if (link) return link;
    }

    if (parsed.protocol === 'com.kupapay.mobile:' && parsed.hostname === 'invite') {
        const link = inviteLinkFromPathname(parsed.pathname);
        if (link) return link;
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
    openGuestClaim = false,
): void {
    if (navigation) {
        (navigation.navigate as any)('Groups', {
            screen: 'GroupDetail',
            params: { groupId, openGuestClaim: openGuestClaim || undefined },
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
    if (link.kind === 'expenseShare') {
        const { data, error } = await supabase.rpc('get_public_expense_share_page', {
            p_token: link.token,
        });
        if (error || !(data as { ok?: boolean })?.ok) {
            showAppToast({ type: 'error', titleKey: 'expenses.shareLinkInvalid' });
            return null;
        }
        showInfoToast('expenses.shareLinkOpenApp');
        return { kind: 'expenseShare' as const };
    }

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
        const failure = parseRpcResult(data);
        if (failure && !failure.ok) {
            handleRedemptionErrorCode(failure.error_code, 'friend');
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
        void captureProductEvent('invite_accepted', { kind: 'friend' });
        return { kind: 'friend' };
    }

    const { data, error } = await supabase.rpc('redeem_group_invite', { p_token: link.token });
    if (error) {
        handleRedemptionError(error, 'group');
        return null;
    }
    const failure = parseRpcResult(data);
    if (failure && !failure.ok) {
        handleRedemptionErrorCode(failure.error_code, 'group');
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    const claimable = !payload.already_member
        ? await listClaimableGuestMembers(payload.group_id)
        : [];
    navigateAfterGroupInvite(navigation, payload.group_id, claimable.length > 0);
    if (!payload.already_member) {
        void captureProductEvent('invite_accepted', { kind: 'group' });
        void trackSecondGroupMemberJoined(payload.group_id);
    }
    return { kind: 'group', groupId: payload.group_id };
}

function handleRedemptionErrorCode(
    errorCode: string,
    kind: 'friend' | 'group' | 'settleReminder',
): void {
    if (errorCode === 'cannot_self_invite') {
        showInfoToast('invite.redemption.selfInvite');
        return;
    }
    if (errorCode === 'invite_not_found') {
        handleError(new Error(errorCode), {
            toast: { titleKey: 'invite.redemption.invalid' },
            tags: { service: 'deepLinks', op: 'redeem', kind, reason: 'invite_not_found' },
        });
        return;
    }
    handleRedemptionError({ message: errorCode }, kind);
}

function handleRedemptionError(error: { message: string }, kind: 'friend' | 'group' | 'settleReminder'): void {
    const message = error.message;
    if (message === 'cannot_self_invite' || message.includes('cannot_self_invite')) {
        showInfoToast('invite.redemption.selfInvite');
        return;
    }
    if (message === 'invite_not_found' || message.includes('invite_not_found')) {
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
