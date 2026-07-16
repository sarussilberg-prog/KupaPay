/**
 * useGroupMembersRealtime — peers joining/leaving this group update avatar
 * stack + member lists. App-level useAppRealtime only filters group_members by
 * current user_id, so other members never see peer INSERTs without this.
 */

import { useEffect, useId } from 'react';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import { invalidateBalanceCaches } from '../lib/invalidateBalanceCaches';
import { queryClient } from '../lib/queryClient';
import { SENTRY_TAGS } from '../lib/sentryTags';
import { queryKeys } from './queries/keys';

/** Invalidate caches that drive the cover member stack and balances. */
export function invalidateGroupMembersCaches(groupId: string): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    void queryClient.invalidateQueries({
        queryKey: queryKeys.groupUsers(groupId),
    });
    invalidateBalanceCaches(groupId);
}

export function useGroupMembersRealtime(groupId: string | undefined | null): void {
    const instanceId = useId();
    useEffect(() => {
        if (!groupId) return;

        const channel = supabase
            .channel(`group_members:${groupId}:${instanceId}`)
            .on(
                'postgres_changes' as never,
                {
                    event: '*',
                    schema: 'public',
                    table: 'group_members',
                    filter: `group_id=eq.${groupId}`,
                },
                () => {
                    try {
                        invalidateGroupMembersCaches(groupId);
                    } catch (err) {
                        Sentry.captureException(err, {
                            tags: { tag: SENTRY_TAGS.REALTIME_ECHO },
                        });
                    }
                },
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    invalidateGroupMembersCaches(groupId);
                }
            });

        return () => {
            void channel.unsubscribe();
            void supabase.removeChannel(channel);
        };
    }, [groupId, instanceId]);
}
