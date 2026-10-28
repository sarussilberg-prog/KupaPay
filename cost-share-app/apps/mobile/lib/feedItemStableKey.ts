import type { FeedItem } from '@cost-share/shared';

/** Stable list keys for group feed rows (expense, settlement, batch, message). */
export function feedItemStableKey(item: FeedItem): string {
    switch (item.kind) {
        case 'expense':
            return `e:${item.expense.id}`;
        case 'settlement':
            return `s:${item.settlement.id}`;
        case 'consolidation_batch':
            return `b:${item.batch.id}`;
        case 'message':
            return `m:${item.message.id}`;
        default: {
            const _exhaustive: never = item;
            return String(_exhaustive);
        }
    }
}
