import { useQuery } from '@tanstack/react-query';
import { fetchMyProStatus } from '../../services/proEntitlements.service';
import { queryKeys } from './keys';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';

export function useProStatusQuery(groupId?: string | null) {
    return useQuery({
        queryKey: queryKeys.proStatus(groupId ?? undefined),
        queryFn: () => fetchMyProStatus(groupId),
        enabled: KUPAPAY_PRO_ENABLED,
        staleTime: 60_000,
    });
}
