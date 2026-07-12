/**
 * useGroupSettlementsRealtime — subscribes to postgres_changes on settlements
 * filtered by group_id. On every event we invalidate the per-group settlement
 * cache and the canonical balance cache. Soft-delete events arrive as UPDATE
 * and the subsequent refetch (which filters on deleted_at IS NULL) drops the row.
 */

import { useEffect, useId } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateBalanceCaches } from '../lib/invalidateBalanceCaches';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from './queries/keys';

export function useGroupSettlementsRealtime(
    groupId: string | undefined | null,
): void {
    const instanceId = useId();
    useEffect(() => {
        if (!groupId) return;

        const channel = supabase
            .channel(`group_settlements:${groupId}:${instanceId}`)
            .on(
                'postgres_changes' as never,
                {
                    event: '*',
                    schema: 'public',
                    table: 'settlements',
                    filter: `group_id=eq.${groupId}`,
                },
                () => {
                    try {
                        void queryClient.invalidateQueries({
                            queryKey: queryKeys.groupContributions(groupId),
                        });
                        invalidateBalanceCaches(groupId);
                    } catch (err) {
                        console.error('settlements realtime payload error:', err);
                    }
                },
            )
            .subscribe((status) => {
                // Parity with the expenses/messages channels: reconcile any
                // events missed during a disconnect when the channel (re)joins.
                if (status === 'SUBSCRIBED') {
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.groupContributions(groupId),
                    });
                    invalidateBalanceCaches(groupId);
                }
            });

        return () => {
            void channel.unsubscribe();
            void supabase.removeChannel(channel);
        };
    }, [groupId, instanceId]);
}
