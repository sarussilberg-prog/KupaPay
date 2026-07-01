import { useQuery } from '@tanstack/react-query';
import { fetchAdminMonetizationMetrics } from '../../services/admin.service';
import { queryKeys } from './keys';

export const ADMIN_MONETIZATION_METRICS_STALE_MS = 60_000;

export function useAdminMonetizationMetricsQuery() {
    return useQuery({
        queryKey: queryKeys.adminMonetizationMetrics,
        queryFn: fetchAdminMonetizationMetrics,
        staleTime: ADMIN_MONETIZATION_METRICS_STALE_MS,
    });
}
