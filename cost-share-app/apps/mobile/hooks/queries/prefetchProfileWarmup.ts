/**
 * Warm profile-tab queries at app start: dashboard, incoming requests, and FX
 * (after dashboard lands) so ProfileScreen opens from cache.
 */

import type { UserDashboard } from '@cost-share/shared';
import { fetchDashboard } from '../../services/dashboard.service';
import { fetchIncomingRequests } from '../../services/friends.service';
import { fetchExchangeRates } from '../../services/exchangeRates.service';
import { collectProfileFxCurrencies } from '../../lib/collectProfileFxCurrencies';
import { queryClient } from '../../lib/queryClient';
import { useAppStore } from '../../store';
import { queryKeys } from './keys';
import { DASHBOARD_STALE_MS } from './useDashboardQuery';
import { EXCHANGE_RATES_STALE_MS } from './useExchangeRatesQuery';
import { INCOMING_REQUESTS_STALE_MS } from './useFriendsQueries';

let warmupInFlight: Promise<void> | null = null;

function prefetchDashboardFx(dashboard: UserDashboard): void {
    const base =
        dashboard.balanceSummary.defaultCurrency ??
        useAppStore.getState().currentUser?.defaultCurrency ??
        'ILS';
    const symbols = collectProfileFxCurrencies(
        dashboard.balanceSummary,
        dashboard.friends,
        base,
    );
    if (symbols.length === 0) return;

    const symbolsKey = symbols.join(',');
    void queryClient.prefetchQuery({
        queryKey: queryKeys.exchangeRates(base, symbolsKey),
        queryFn: () => fetchExchangeRates(base, symbols),
        staleTime: EXCHANGE_RATES_STALE_MS,
    });
}

export function prefetchProfileWarmup(): void {
    const { currentUser } = useAppStore.getState();
    if (!currentUser?.id) return;

    if (warmupInFlight) return;

    const dashboardState = queryClient.getQueryState(queryKeys.dashboard);
    const shouldFetchDashboard =
        !dashboardState?.dataUpdatedAt ||
        Date.now() - dashboardState.dataUpdatedAt >= DASHBOARD_STALE_MS;

    const incomingState = queryClient.getQueryState(queryKeys.friendRequestsIncoming);
    const shouldFetchIncoming =
        !incomingState?.dataUpdatedAt ||
        Date.now() - incomingState.dataUpdatedAt >= INCOMING_REQUESTS_STALE_MS;

    if (!shouldFetchDashboard && !shouldFetchIncoming) {
        const cached = queryClient.getQueryData<UserDashboard | null>(queryKeys.dashboard);
        if (cached) prefetchDashboardFx(cached);
        return;
    }

    warmupInFlight = Promise.all([
        shouldFetchDashboard
            ? queryClient.prefetchQuery({
                  queryKey: queryKeys.dashboard,
                  queryFn: fetchDashboard,
                  staleTime: DASHBOARD_STALE_MS,
              })
            : Promise.resolve(),
        shouldFetchIncoming
            ? queryClient.prefetchQuery({
                  queryKey: queryKeys.friendRequestsIncoming,
                  queryFn: fetchIncomingRequests,
                  staleTime: INCOMING_REQUESTS_STALE_MS,
              })
            : Promise.resolve(),
    ])
        .then(() => {
            const dashboard = queryClient.getQueryData<UserDashboard | null>(queryKeys.dashboard);
            if (dashboard) prefetchDashboardFx(dashboard);
        })
        .catch(err => {
            console.error('prefetchProfileWarmup failed:', err);
        })
        .finally(() => {
            warmupInFlight = null;
        });
}
