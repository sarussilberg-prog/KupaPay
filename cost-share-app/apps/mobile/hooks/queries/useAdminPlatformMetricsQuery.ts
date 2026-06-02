import { useQuery } from '@tanstack/react-query';
import { fetchAdminPlatformMetrics } from '../../services/admin.service';
import { queryKeys } from './keys';

export const ADMIN_METRICS_STALE_MS = 60_000;

export function useAdminPlatformMetricsQuery() {
    return useQuery({
        queryKey: queryKeys.adminPlatformMetrics,
        queryFn: fetchAdminPlatformMetrics,
        staleTime: ADMIN_METRICS_STALE_MS,
    });
}
