/**
 * Feed selector — builds a FeedItem[] for GroupDetailScreen
 * by interleaving the group's expenses, messages, settlements,
 * and consolidation batches, sorted by createdAt DESC.
 */

import {
    ConsolidationBatch,
    ExpenseWithSplits,
    GroupMessage,
    FeedItem,
    Settlement,
} from '@cost-share/shared';
import { decorateExpense } from './expense-delta';
import { toEpochMs } from '../lib/dateUtils';

export function buildFeed(
    groupId: string,
    expenses: ExpenseWithSplits[],
    messages: GroupMessage[],
    settlements: Settlement[],
    currentUserId: string,
    batches: ConsolidationBatch[] = [],
): FeedItem[] {
    // Build a set of settlement IDs that belong to a batch so they are not
    // shown as individual rows — the batch row represents them.
    // A settlement with consolidationBatchId is always hidden as an individual
    // row, even if the batch hasn't loaded yet (prevents a race where settlements
    // refetch before batches and temporarily leak through as individual rows).
    const batchedSettlementIds = new Set<string>();
    const batchSettlementMap = new Map<string, Settlement[]>();
    for (const batch of batches) {
        batchSettlementMap.set(batch.id, []);
    }
    for (const s of settlements) {
        if (s.consolidationBatchId) {
            batchedSettlementIds.add(s.id);
            batchSettlementMap.get(s.consolidationBatchId)?.push(s);
        }
    }

    const expenseItems: FeedItem[] = expenses
        .filter(e => e.groupId === groupId && !e.isDeleted)
        .map(e => ({
            kind: 'expense',
            sortAt: e.createdAt,
            expense: decorateExpense(e, currentUserId),
        }));

    const messageItems: FeedItem[] = messages
        .filter(m => !m.isDeleted)
        .map(m => ({
            kind: 'message',
            sortAt: m.createdAt,
            message: m,
        }));

    const settlementItems: FeedItem[] = settlements
        .filter(s => s.groupId === groupId && s.deletedAt === null && !batchedSettlementIds.has(s.id))
        .map(s => ({
            kind: 'settlement',
            sortAt: s.createdAt,
            settlement: s,
        }));

    const batchItems: FeedItem[] = batches
        .filter(b => b.groupId === groupId && b.deletedAt === null)
        .map(b => ({
            kind: 'consolidation_batch',
            sortAt: b.createdAt,
            batch: b,
            settlements: batchSettlementMap.get(b.id) ?? [],
        }));

    return [...expenseItems, ...messageItems, ...settlementItems, ...batchItems].sort(
        (a, b) => toEpochMs(b.sortAt) - toEpochMs(a.sortAt),
    );
}
