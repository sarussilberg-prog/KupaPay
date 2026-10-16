/**
 * Background-warm the add-expense prerequisites (members + user profiles) for
 * every group the user belongs to.
 *
 * Batched: two Supabase round-trips for all groups (fixes GroupsList N+1 — Sentry COPAY-MOBILE-PROD-K).
 */

import type { GroupMember, GroupWithMembers, User } from '@cost-share/shared';
import { groupMemberFromRow, profileFromRow } from '@cost-share/shared';
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from './keys';

let batchInFlight: Promise<void> | null = null;

function groupIdsNeedingPrefetch(groupIds: string[]): string[] {
    return groupIds.filter(groupId => {
        const hasMembers = queryClient.getQueryData(queryKeys.groupMembers(groupId)) !== undefined;
        const hasUsers = queryClient.getQueryData(queryKeys.groupUsers(groupId)) !== undefined;
        return !(hasMembers && hasUsers);
    });
}

async function batchPrefetchAddExpensePrerequisites(groupIds: string[]): Promise<void> {
    const targets = groupIdsNeedingPrefetch(groupIds);
    if (targets.length === 0) return;

    const { data: memberRows, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .in('group_id', targets)
        .eq('is_active', true);
    if (membersError) {
        console.error('batchPrefetchAddExpensePrerequisites members failed:', membersError);
        return;
    }

    const membersByGroup = new Map<string, GroupMember[]>();
    for (const row of memberRows ?? []) {
        const member = groupMemberFromRow(row);
        const list = membersByGroup.get(member.groupId) ?? [];
        list.push(member);
        membersByGroup.set(member.groupId, list);
    }

    const userIds = [
        ...new Set((memberRows ?? []).map(row => String(row.user_id)).filter(Boolean)),
    ];
    const usersById = new Map<string, User>();
    if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);
        if (profilesError) {
            console.error('batchPrefetchAddExpensePrerequisites profiles failed:', profilesError);
        } else {
            for (const row of profileRows ?? []) {
                const user = profileFromRow(row);
                usersById.set(user.id, user);
            }
        }
    }

    for (const groupId of targets) {
        const members = membersByGroup.get(groupId) ?? [];
        queryClient.setQueryData(queryKeys.groupMembers(groupId), members);
        const users = members
            .map(m => usersById.get(m.userId))
            .filter((u): u is User => Boolean(u));
        queryClient.setQueryData(queryKeys.groupUsers(groupId), users);
    }
}

export function prefetchAddExpensePrerequisitesBatched(groupIds: string[]): void {
    const unique = [...new Set(groupIds.filter(Boolean))];
    if (unique.length === 0) return;

    batchInFlight = (batchInFlight ?? Promise.resolve())
        .then(() => batchPrefetchAddExpensePrerequisites(unique))
        .catch(err => {
            console.error('prefetchAddExpensePrerequisitesBatched failed:', err);
        })
        .finally(() => {
            batchInFlight = null;
        });
}

export function prefetchAddExpensePrerequisitesForGroup(groupId: string): void {
    prefetchAddExpensePrerequisitesBatched([groupId]);
}

export function prefetchAddExpensePrerequisitesForAllGroups(): void {
    const groups =
        queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
    prefetchAddExpensePrerequisitesBatched(groups.map(g => g.id));
}
