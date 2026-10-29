/**
 * Users Service — Supabase direct (profiles table)
 */

import { User, UpdateProfileDto, profileFromRow, PROFILE_SELECT_COLUMNS } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { clearLocalAuthSession } from './auth.service';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';
import { useAppStore } from '../store';
import { HEBREW_APP_DEFAULT_CURRENCY } from '../lib/appDefaultCurrency';
import { isAscScreenshotDemo } from '../lib/ascScreenshotDemo';
import { ascCaptureUsersForGroup } from '../screenshotDemo/ascCaptureFixtures';
export type ProfileHydrationResult = 'active' | 'deactivated' | 'unknown';

/** Client read path for app_admins — profiles table does not expose admin flag. */
export async function fetchIsAppAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_app_admin');
    if (error) return false;
    return data === true;
}

/**
 * Load profiles.default_currency (and other fields) after auth.
 * - 'active'     : profile loaded into the store.
 * - 'deactivated': server reported is_active=false; local session has been cleared.
 * - 'unknown'    : fetch errored (e.g. offline) or row not yet present. Caller must NOT
 *                  treat as deactivated — leave the session intact and try again later.
 */
export async function hydrateCurrentUserProfile(userId: string): Promise<ProfileHydrationResult> {
    const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return 'unknown';

    const profile = profileFromRow(data);
    if (profile.isActive === false) {
        await clearLocalAuthSession();
        return 'deactivated';
    }

    const { data: inviteToken } = await supabase.rpc('get_my_invite_token');
    if (typeof inviteToken === 'string' && inviteToken.length > 0) {
        profile.inviteToken = inviteToken;
    }

    // Resolve the caller's admin status via the SECURITY DEFINER RPC.
    // app_admins is RLS-locked; this RPC is the only client-facing read path.
    const isAdminFlag = await fetchIsAppAdmin();
    let user = { ...profile, isAdmin: isAdminFlag };

    const appLanguage = useAppStore.getState().language;
    if (appLanguage === 'he' && user.language === 'en') {
        const patch: UpdateProfileDto = { language: 'he' };
        if (user.defaultCurrency === 'USD') {
            patch.defaultCurrency = HEBREW_APP_DEFAULT_CURRENCY;
        }
        const synced = await updateUser(userId, patch);
        if (synced) user = { ...synced, isAdmin: isAdminFlag };
    }

    useAppStore.getState().setCurrentUser(user);
    return 'active';
}

export async function fetchUsers(): Promise<User[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Failed to fetch users:', error);
        return [];
    }
    return (data ?? []).map(profileFromRow);
}

/** Fetch profiles for active members of a specific group only. */
export async function fetchGroupUsers(groupId: string): Promise<User[]> {
    if (isAscScreenshotDemo()) {
        return ascCaptureUsersForGroup(groupId);
    }
    const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('is_active', true);
    if (membersError) {
        console.error('Failed to fetch group member ids:', membersError);
        return [];
    }

    const userIds = (members ?? []).map((row) => row.user_id as string);
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .in('id', userIds)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Failed to fetch group users:', error);
        return [];
    }
    return (data ?? []).map(profileFromRow);
}

export async function updateUser(id: string, dto: UpdateProfileDto): Promise<User | null> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.avatarUrl !== undefined) patch.avatar_url = dto.avatarUrl;
    if (dto.defaultCurrency !== undefined) patch.default_currency = dto.defaultCurrency;
    if (dto.language !== undefined) patch.language = dto.language;

    const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select(PROFILE_SELECT_COLUMNS)
        .maybeSingle();

    if (error || !data) return null;

    const user = profileFromRow(data);
    const currentUser = useAppStore.getState().currentUser;
    if (currentUser && currentUser.id === id && !user.inviteToken && currentUser.inviteToken) {
        user.inviteToken = currentUser.inviteToken;
    }
    if (currentUser && currentUser.id === id) {
        const isAdmin = await fetchIsAppAdmin();
        useAppStore.getState().setCurrentUser({ ...user, isAdmin });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        void queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
    }
    return user;
}

/** Refresh admin flag from DB (e.g. Settings open with stale persisted currentUser). */
export async function refreshCurrentUserAdminFlag(): Promise<void> {
    const currentUser = useAppStore.getState().currentUser;
    if (!currentUser) return;
    const isAdmin = await fetchIsAppAdmin();
    if (currentUser.isAdmin !== isAdmin) {
        useAppStore.getState().setCurrentUser({ ...currentUser, isAdmin });
    }
}
