/**
 * Invite Service — builds invite URLs, opens the OS share sheet,
 * rotates tokens. Reads invite tokens from the current user / group;
 * writes via SECURITY DEFINER RPCs.
 */

import {
    buildInviteUrl,
    buildPublicGroupBalanceUrl,
    buildSettleReminderUrl,
    buildWhatsAppShareUrl,
    type GroupWithMembers,
} from '@cost-share/shared';
export { buildInviteUrl, buildPublicGroupBalanceUrl, buildSettleReminderUrl };
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import i18n from '../i18n';
import { shareTextMessage } from '../lib/platformShare';
import { showSuccessMessage } from '../lib/appToast';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';
import { captureProductEvent } from '../lib/productAnalytics';

export function buildFriendInviteMessage(inviterName: string, url: string): string {
    return i18n.t('invite.friend.shareMessage', { inviterName, url });
}

export function buildGroupInviteMessage(
    inviterName: string,
    groupName: string,
    url: string,
): string {
    return i18n.t('invite.group.shareMessage', { inviterName, groupName, url });
}

export function buildGroupBalanceShareMessage(groupName: string, url: string): string {
    return i18n.t('groups.share.balanceLinkMessage', { groupName, url });
}

type GroupInviteContext = {
    groupId: string;
    group: GroupWithMembers;
    user: NonNullable<ReturnType<typeof useAppStore.getState>['currentUser']>;
    url: string;
    message: string;
};

function resolveGroupInviteContext(groupId: string): GroupInviteContext {
    const user = useAppStore.getState().currentUser;
    const groups = queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
    const group = groups.find(g => g.id === groupId);
    if (!user) throw new Error('not_authenticated');
    if (!group || !group.inviteToken) throw new Error('group_invite_token_unavailable');
    const url = buildInviteUrl('group', group.inviteToken);
    const message = buildGroupInviteMessage(user.name, group.name, url);
    return { groupId, group, user, url, message };
}

async function openShare(message: string): Promise<void> {
    await shareTextMessage(message);
}

export function getGroupInviteSharePayload(groupId: string): { url: string; message: string } {
    const { url, message } = resolveGroupInviteContext(groupId);
    return { url, message };
}

export async function shareFriendInvite(): Promise<void> {
    const user = useAppStore.getState().currentUser;
    if (!user || !user.inviteToken) throw new Error('no_invite_token');
    const url = buildInviteUrl('friend', user.inviteToken);
    const message = buildFriendInviteMessage(user.name, url);
    await openShare(message);
    void captureProductEvent('invite_sent', { kind: 'friend' });
}

export async function shareGroupInvite(groupId: string): Promise<void> {
    const { message } = resolveGroupInviteContext(groupId);
    await openShare(message);
    void captureProductEvent('invite_sent', { kind: 'group', channel: 'share_sheet', group_id: groupId });
}

function resolveGroupBalanceShareContext(groupId: string): {
    group: GroupWithMembers;
    url: string;
    message: string;
} {
    const user = useAppStore.getState().currentUser;
    const groups = queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
    const group = groups.find(g => g.id === groupId);
    if (!user) throw new Error('not_authenticated');
    if (!group?.publicBalanceToken) throw new Error('group_public_balance_token_unavailable');
    if (group.publicBalanceSharingEnabled !== true) {
        throw new Error('group_public_balance_sharing_disabled');
    }
    const url = buildPublicGroupBalanceUrl(group.publicBalanceToken);
    const message = buildGroupBalanceShareMessage(group.name, url);
    return { group, url, message };
}

export async function shareGroupBalanceLink(groupId: string): Promise<void> {
    const { message } = resolveGroupBalanceShareContext(groupId);
    await openShare(message);
    void captureProductEvent('invite_sent', {
        kind: 'group',
        channel: 'public_balance_link',
        group_id: groupId,
    });
}

export async function setGroupPublicBalanceSharing(
    groupId: string,
    enabled: boolean,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('set_group_public_balance_sharing', {
        p_group_id: groupId,
        p_enabled: enabled,
    });
    if (error) throw error;
    return Boolean(data);
}

export async function rotateGroupPublicBalanceLink(groupId: string): Promise<string> {
    const { data, error } = await supabase.rpc('rotate_group_public_balance', {
        p_group_id: groupId,
    });
    if (error) throw error;
    const newToken = data as string;
    queryClient.setQueryData<GroupWithMembers[]>(queryKeys.groups, (prev) =>
        (prev ?? []).map((g) =>
            g.id === groupId ? { ...g, publicBalanceToken: newToken } : g,
        ),
    );
    return newToken;
}

export async function shareGroupInviteViaWhatsApp(groupId: string): Promise<void> {
    const { message } = resolveGroupInviteContext(groupId);
    const waUrl = buildWhatsAppShareUrl(message);
    await Linking.openURL(waUrl);
    void captureProductEvent('invite_sent', { kind: 'group', channel: 'whatsapp', group_id: groupId });
}

export async function copyGroupInviteLink(groupId: string): Promise<void> {
    const { url } = resolveGroupInviteContext(groupId);
    await Clipboard.setStringAsync(url);
    showSuccessMessage('common.linkCopied');
    void captureProductEvent('invite_sent', { kind: 'group', channel: 'copy_link', group_id: groupId });
}

export async function rotateFriendInvite(): Promise<string> {
    const { data, error } = await supabase.rpc('rotate_friend_invite');
    if (error) throw error;
    const newToken = data as string;
    // Update the store in place
    const current = useAppStore.getState().currentUser;
    if (current) {
        useAppStore.getState().setCurrentUser({ ...current, inviteToken: newToken });
    }
    return newToken;
}

export async function rotateGroupInvite(groupId: string): Promise<string> {
    const { data, error } = await supabase.rpc('rotate_group_invite', { p_group_id: groupId });
    if (error) throw error;
    const newToken = data as string;
    queryClient.setQueryData<GroupWithMembers[]>(queryKeys.groups, (prev) =>
        (prev ?? []).map((g) =>
            g.id === groupId ? { ...g, inviteToken: newToken } : g,
        ),
    );
    return newToken;
}

