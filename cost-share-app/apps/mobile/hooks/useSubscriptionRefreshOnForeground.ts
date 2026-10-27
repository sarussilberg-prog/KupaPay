import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries/keys';
import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import { isPurchasesConfigured } from '../services/purchases.service';

/** Refresh RevenueCat + server subscription snapshot when app returns to foreground. */
export function useSubscriptionRefreshOnForeground(): void {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!KUPAPAY_PRO_ENABLED && !isPurchasesConfigured()) return;

        let lastState: AppStateStatus = AppState.currentState;

        const sub = AppState.addEventListener('change', next => {
            const wasBackground = lastState === 'background' || lastState === 'inactive';
            lastState = next;
            if (wasBackground && next === 'active') {
                void queryClient.invalidateQueries({ queryKey: queryKeys.proStatus() });
                void queryClient.invalidateQueries({ queryKey: queryKeys.mySubscription() });
            }
        });

        return () => sub.remove();
    }, [queryClient]);
}
