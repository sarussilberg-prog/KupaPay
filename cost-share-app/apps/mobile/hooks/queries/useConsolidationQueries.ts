import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConsolidationBatch, DisplaySettlement, groupSettlementsForDisplay } from '@cost-share/shared';
import {
    createConsolidationBatch,
    deleteConsolidationBatch,
    CreateConsolidationBatchParams,
} from '../../services/consolidation.service';
import { fetchConsolidationBatches, fetchSettlements } from '../../services/settlements.service';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { queryKeys } from './keys';

export function useGroupConsolidationBatchesQuery(groupId: string) {
    return useQuery<ConsolidationBatch[]>({
        queryKey: queryKeys.consolidationBatches(groupId),
        queryFn: () => fetchConsolidationBatches(groupId),
        enabled: Boolean(groupId),
    });
}

/** Combined query: settlements + batches → DisplaySettlement[]. */
export function useDisplaySettlementsQuery(groupId: string) {
    return useQuery<DisplaySettlement[]>({
        queryKey: [...queryKeys.groupSettlements(groupId), 'display'],
        queryFn: async () => {
            const [settlements, batches] = await Promise.all([
                fetchSettlements(groupId),
                fetchConsolidationBatches(groupId),
            ]);
            return groupSettlementsForDisplay(settlements, batches);
        },
        enabled: Boolean(groupId),
    });
}

function useInvalidateAfterBatchChange(groupId: string) {
    const queryClient = useQueryClient();
    return () => {
        invalidateBalanceCaches(groupId);
        void queryClient.invalidateQueries({ queryKey: queryKeys.groupSettlements(groupId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.consolidationBatches(groupId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
    };
}

export function useCreateConsolidationBatchMutation(groupId: string) {
    const invalidate = useInvalidateAfterBatchChange(groupId);
    return useMutation({
        mutationFn: (params: CreateConsolidationBatchParams) =>
            createConsolidationBatch(params),
        onSuccess: invalidate,
    });
}

export function useDeleteConsolidationBatchMutation(groupId: string) {
    const invalidate = useInvalidateAfterBatchChange(groupId);
    return useMutation({
        mutationFn: (batchId: string) => deleteConsolidationBatch(batchId),
        onSuccess: invalidate,
    });
}
