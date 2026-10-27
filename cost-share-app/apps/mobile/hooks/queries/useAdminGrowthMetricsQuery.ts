import { useQuery } from '@tanstack/react-query';
import { fetchAdminGrowthMetrics } from '../../services/admin.service';
import { queryKeys } from './keys';

export const ADMIN_GROWTH_METRICS_STALE_MS = 60_000;

export function useAdminGrowthMetricsQuery() {
    return useQuery({
        queryKey: queryKeys.adminGrowthMetrics,
        queryFn: fetchAdminGrowthMetrics,
        staleTime: ADMIN_GROWTH_METRICS_STALE_MS,
    });
}
