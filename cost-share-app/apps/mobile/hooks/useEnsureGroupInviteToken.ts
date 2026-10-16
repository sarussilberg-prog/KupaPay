/**
 * Ensures the React Query groups cache has inviteToken for a group (e.g. right after create).
 */

import { useEffect, useState } from 'react';
import type { GroupWithMembers } from '@cost-share/shared';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from './queries/keys';
import { getGroupById } from '../services/groups.service';

export function useEnsureGroupInviteToken(groupId: string): boolean {
    const [ready, setReady] = useState(() => {
        const groups = queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
        const g = groups.find(x => x.id === groupId);
        return Boolean(g?.inviteToken);
    });

    useEffect(() => {
        let cancelled = false;
        const groups = queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
        const cached = groups.find(g => g.id === groupId);
        if (cached?.inviteToken) {
            setReady(true);
            return;
        }

        void (async () => {
            const fresh = await getGroupById(groupId);
            if (cancelled || !fresh?.inviteToken) return;
            queryClient.setQueryData<GroupWithMembers[]>(queryKeys.groups, prev =>
                (prev ?? []).map(g => (g.id === groupId ? { ...g, inviteToken: fresh.inviteToken } : g)),
            );
            setReady(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [groupId]);

    return ready;
}
