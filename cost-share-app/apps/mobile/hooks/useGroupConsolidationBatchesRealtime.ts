/**
 * useGroupConsolidationBatchesRealtime — subscribes to postgres_changes on
 * consolidation_batches filtered by group_id. On every event we invalidate
 * the per-group batch cache and the canonical balance cache. Soft-delete
 * events arrive as UPDATE and the subsequent refetch (which filters on
 * deleted_at IS NULL) drops the row from the group feed.
 */

import { useEffect, useId } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateBalanceCaches } from '../lib/invalidateBalanceCaches';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from './queries/keys';

export function useGroupConsolidationBatchesRealtime(
    groupId: string | undefined | null,
): void {
    const instanceId = useId();
    useEffect(() => {
        if (!groupId) return;

        const channel = supabase
            .channel(`group_consolidation_batches:${groupId}:${instanceId}`)
            .on(
                'postgres_changes' as never,
                {
                    event: '*',
                    schema: 'public',
                    table: 'consolidation_batches',
                    filter: `group_id=eq.${groupId}`,
                },
                () => {
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.consolidationBatches(groupId),
                    });
                    invalidateBalanceCaches(groupId);
                },
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.consolidationBatches(groupId),
                    });
                }
            });

        return () => {
            void channel.unsubscribe();
            void supabase.removeChannel(channel);
        };
    }, [groupId, instanceId]);
}
