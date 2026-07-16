/**
 * Pure expense realtime cache appliers — payload-first upsert (messages parity),
 * then optional hydrate of splits. Exported for unit tests.
 */
import type { ExpenseWithSplits } from '@cost-share/shared';
import { expenseFromRow } from '@cost-share/shared';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateBalanceCaches } from './invalidateBalanceCaches';
import { queryKeys } from '../hooks/queries/keys';

export type ExpenseRealtimePayload = {
    eventType: string;
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
};

function removeExpenseFromCache(
    client: QueryClient,
    groupId: string,
    expenseId: string,
): void {
    client.setQueryData<ExpenseWithSplits[]>(
        queryKeys.groupExpenses(groupId),
        (prev) => (prev ?? []).filter((e) => e.id !== expenseId),
    );
}

function upsertExpenseInCache(
    client: QueryClient,
    groupId: string,
    expense: ExpenseWithSplits,
): void {
    client.setQueryData<ExpenseWithSplits[]>(
        queryKeys.groupExpenses(groupId),
        (prev) => {
            const list = prev ?? [];
            return list.some((e) => e.id === expense.id)
                ? list.map((e) => (e.id === expense.id ? expense : e))
                : [...list, expense];
        },
    );
}

/**
 * Immediate cache mutation from the realtime row. Never waits on REST.
 * Returns the expense id that still needs split hydration, or null.
 */
export function applyExpenseRealtimeEventSync(
    client: QueryClient,
    groupId: string,
    payload: ExpenseRealtimePayload,
): string | null {
    if (payload.eventType === 'DELETE' && payload.old) {
        const oldId = payload.old.id as string | undefined;
        if (oldId) {
            removeExpenseFromCache(client, groupId, oldId);
            invalidateBalanceCaches(groupId);
        }
        return null;
    }

    if (
        (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') &&
        payload.new
    ) {
        const id = payload.new.id as string | undefined;
        if (!id) return null;

        if (payload.new.is_deleted === true) {
            removeExpenseFromCache(client, groupId, id);
            invalidateBalanceCaches(groupId);
            return null;
        }

        const base = expenseFromRow(payload.new);
        const previous = client
            .getQueryData<ExpenseWithSplits[]>(queryKeys.groupExpenses(groupId))
            ?.find((e) => e.id === id);
        const splits =
            payload.eventType === 'UPDATE' && previous?.splits?.length
                ? previous.splits
                : [];

        upsertExpenseInCache(client, groupId, { ...base, splits });
        invalidateBalanceCaches(groupId);
        return id;
    }

    return null;
}

/** Replace the optimistic row with full splits; on miss, invalidate the feed. */
export async function hydrateExpenseAfterRealtime(
    client: QueryClient,
    groupId: string,
    expenseId: string,
    getExpenseWithSplitsById: (
        id: string,
    ) => Promise<ExpenseWithSplits | null>,
): Promise<void> {
    try {
        const expense = await getExpenseWithSplitsById(expenseId);
        if (!expense) {
            void client.invalidateQueries({
                queryKey: queryKeys.groupExpenses(groupId),
            });
            invalidateBalanceCaches(groupId);
            return;
        }
        upsertExpenseInCache(client, groupId, expense);
        invalidateBalanceCaches(groupId);
    } catch {
        void client.invalidateQueries({
            queryKey: queryKeys.groupExpenses(groupId),
        });
        invalidateBalanceCaches(groupId);
    }
}
