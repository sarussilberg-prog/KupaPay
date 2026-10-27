import { useQuery } from '@tanstack/react-query';
import type { GroupWithMembers } from '@cost-share/shared';
import { queryKeys } from './queries/keys';
import { queryClient } from '../lib/queryClient';
import { fetchMySubscriptionSnapshot } from '../services/mySubscription.service';
import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import { useProStatus } from './useProStatus';
import { isPurchasesConfigured } from '../services/purchases.service';

export function useMySubscription() {
    const groups =
        queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
    const { hasPro } = useProStatus();
    const purchasesReady = isPurchasesConfigured();

    return useQuery({
        queryKey: queryKeys.mySubscription(),
        queryFn: () => fetchMySubscriptionSnapshot(groups),
        enabled: KUPAPAY_PRO_ENABLED || hasPro || purchasesReady,
        staleTime: 30_000,
    });
}
