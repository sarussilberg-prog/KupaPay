import type { Settlement, ConsolidationBatch, DisplaySettlement } from '../types';

/**
 * Folds raw settlements and batches into DisplaySettlement[] for rendering.
 * Batched settlements (those with a consolidation_batch_id) are grouped under
 * their ConsolidationBatch row and emitted as a single 'batch' entry.
 * Settlements whose batch row is missing fall back to 'standalone' so orphaned
 * rows never disappear silently.
 *
 * Output is sorted by effective date descending:
 *   batch → batch.createdAt
 *   standalone → settlement.createdAt
 */
export function groupSettlementsForDisplay(
    settlements: Settlement[],
    batches: ConsolidationBatch[],
): DisplaySettlement[] {
    const batchMap = new Map<string, ConsolidationBatch>(
        batches.map(b => [b.id, b]),
    );

    const batchSettlementsMap = new Map<string, Settlement[]>();
    const standalones: Settlement[] = [];

    for (const s of settlements) {
        if (s.consolidationBatchId && batchMap.has(s.consolidationBatchId)) {
            const existing = batchSettlementsMap.get(s.consolidationBatchId) ?? [];
            existing.push(s);
            batchSettlementsMap.set(s.consolidationBatchId, existing);
        } else {
            standalones.push(s);
        }
    }

    const result: DisplaySettlement[] = [
        ...standalones.map(s => ({ kind: 'standalone' as const, settlement: s })),
        ...Array.from(batchSettlementsMap.entries()).map(([batchId, batchSettlements]) => ({
            kind: 'batch' as const,
            batch: batchMap.get(batchId)!,
            settlements: batchSettlements,
        })),
    ];

    result.sort((a, b) => {
        const aTime = a.kind === 'batch'
            ? a.batch.createdAt.getTime()
            : a.settlement.createdAt.getTime();
        const bTime = b.kind === 'batch'
            ? b.batch.createdAt.getTime()
            : b.settlement.createdAt.getTime();
        return bTime - aTime;
    });

    return result;
}

/**
 * Returns the Settlement for a standalone DisplaySettlement, or null for a batch.
 * Use to pass settlements to components that only understand raw Settlement.
 */
export function unwrapDisplaySettlement(item: DisplaySettlement): Settlement | null {
    return item.kind === 'standalone' ? item.settlement : null;
}
