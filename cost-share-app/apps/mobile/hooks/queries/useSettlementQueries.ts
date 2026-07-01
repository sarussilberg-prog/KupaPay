/**
 * Settlement queries + mutations — group settlements list + create/update/
 * delete mutations that invalidate the canonical balance cache.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CreateSettlementDto,
    UpdateSettlementDto,
} from '@cost-share/shared';
import {
    createSettlement,
    deleteSettlement,
    fetchSettlements,
    updateSettlement,
} from '../../services/settlements.service';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { queryKeys } from './keys';

export function useGroupSettlementsQuery(groupId: string) {
    return useQuery({
        queryKey: queryKeys.groupSettlements(groupId),
        queryFn: () => fetchSettlements(groupId),
        enabled: Boolean(groupId),
    });
}

function useInvalidateAfterSettlementChange(groupId: string) {
    const queryClient = useQueryClient();
    return () => {
        invalidateBalanceCaches(groupId);
        void queryClient.invalidateQueries({
            queryKey: queryKeys.groupContributions(groupId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
        // Invalidate display settlements so groupSettlementsForDisplay re-runs
        void queryClient.invalidateQueries({
            queryKey: [...queryKeys.groupSettlements(groupId), 'display'],
        });
    };
}

export function useCreateSettlementMutation(groupId: string) {
    const invalidate = useInvalidateAfterSettlementChange(groupId);
    return useMutation({
        mutationFn: (dto: CreateSettlementDto) => createSettlement(dto),
        onSuccess: invalidate,
    });
}

export function useUpdateSettlementMutation(groupId: string) {
    const invalidate = useInvalidateAfterSettlementChange(groupId);
    return useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateSettlementDto }) =>
            updateSettlement(id, dto),
        onSuccess: invalidate,
    });
}

export function useDeleteSettlementMutation(groupId: string) {
    const invalidate = useInvalidateAfterSettlementChange(groupId);
    return useMutation({
        mutationFn: (id: string) => deleteSettlement(id),
        onSuccess: invalidate,
    });
}
