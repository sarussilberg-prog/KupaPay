/**
 * useGroupExpensesRealtime — payload-first upsert into groupExpenses, then
 * hydrate splits via REST. On hydrate miss/error, invalidate the expenses
 * query (never silent-drop the feed update).
 */

import { useEffect, useId } from 'react';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import { getExpenseWithSplitsById } from '../services/expenses.service';
import { queryClient } from '../lib/queryClient';
import {
    applyExpenseRealtimeEventSync,
    hydrateExpenseAfterRealtime,
} from '../lib/applyExpenseRealtimeEvent';
import { SENTRY_TAGS } from '../lib/sentryTags';
import { queryKeys } from './queries/keys';

export function useGroupExpensesRealtime(groupId: string | undefined | null): void {
    const instanceId = useId();
    useEffect(() => {
        if (!groupId) return;

        const channel = supabase
            .channel(`group_expenses:${groupId}:${instanceId}`)
            .on(
                'postgres_changes' as never,
                {
                    event: '*',
                    schema: 'public',
                    table: 'expenses',
                    filter: `group_id=eq.${groupId}`,
                },
                (payload: {
                    eventType: string;
                    new?: Record<string, unknown>;
                    old?: Record<string, unknown>;
                }) => {
                    try {
                        const hydrateId = applyExpenseRealtimeEventSync(
                            queryClient,
                            groupId,
                            payload,
                        );
                        if (!hydrateId) return;
                        void hydrateExpenseAfterRealtime(
                            queryClient,
                            groupId,
                            hydrateId,
                            getExpenseWithSplitsById,
                        ).catch((err) => {
                            Sentry.captureException(err, {
                                tags: { tag: SENTRY_TAGS.REALTIME_ECHO },
                            });
                        });
                    } catch (err) {
                        Sentry.captureException(err, {
                            tags: { tag: SENTRY_TAGS.REALTIME_ECHO },
                        });
                        void queryClient.invalidateQueries({
                            queryKey: queryKeys.groupExpenses(groupId),
                        });
                    }
                },
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.groupExpenses(groupId),
                    });
                }
            });

        return () => {
            void channel.unsubscribe();
            void supabase.removeChannel(channel);
        };
    }, [groupId, instanceId]);
}
