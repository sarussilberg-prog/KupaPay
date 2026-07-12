import {
    groupSettlementsForDisplay,
} from '@cost-share/shared/calculations/groupSettlementsForDisplay';
import type { Settlement, ConsolidationBatch } from '@cost-share/shared';

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
    return {
        id: 'settle-1',
        groupId: 'group-1',
        fromUserId: 'user-a',
        toUserId: 'user-b',
        amount: 100,
        currency: 'ILS',
        settlementDate: new Date('2026-06-28'),
        createdBy: 'user-a',
        createdAt: new Date('2026-06-28T10:00:00Z'),
        updatedAt: new Date('2026-06-28T10:00:00Z'),
        deletedAt: null,
        ...overrides,
    };
}

function makeBatch(overrides: Partial<ConsolidationBatch> = {}): ConsolidationBatch {
    return {
        id: 'batch-1',
        groupId: 'group-1',
        paidByUserId: 'user-a',
        paymentAmount: 118.5,
        paymentCurrency: 'ILS',
        createdAt: new Date('2026-06-28T11:00:00Z'),
        deletedAt: null,
        ...overrides,
    };
}

describe('groupSettlementsForDisplay', () => {
    it('wraps a standalone settlement as kind=standalone', () => {
        const s = makeSettlement();
        const result = groupSettlementsForDisplay([s], []);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('standalone');
        if (result[0].kind === 'standalone') {
            expect(result[0].settlement.id).toBe('settle-1');
        }
    });

    it('groups batched settlements under their batch', () => {
        const batch = makeBatch();
        const s1 = makeSettlement({ id: 's1', consolidationBatchId: 'batch-1', currency: 'USD', amount: 5 });
        const s2 = makeSettlement({ id: 's2', consolidationBatchId: 'batch-1', currency: 'ILS', amount: 100 });
        const result = groupSettlementsForDisplay([s1, s2], [batch]);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('batch');
        if (result[0].kind === 'batch') {
            expect(result[0].batch.id).toBe('batch-1');
            expect(result[0].settlements).toHaveLength(2);
        }
    });

    it('handles mixed standalone and batch settlements', () => {
        const batch = makeBatch();
        const batched = makeSettlement({ id: 'b1', consolidationBatchId: 'batch-1' });
        const standalone = makeSettlement({ id: 's1' });
        const result = groupSettlementsForDisplay([batched, standalone], [batch]);
        expect(result).toHaveLength(2);
        const kinds = result.map(r => r.kind);
        expect(kinds).toContain('batch');
        expect(kinds).toContain('standalone');
    });

    it('sorts by createdAt descending (batch.createdAt vs settlement.createdAt)', () => {
        const batch = makeBatch({ createdAt: new Date('2026-06-28T12:00:00Z') });
        const batched = makeSettlement({ id: 'b1', consolidationBatchId: 'batch-1', createdAt: new Date('2026-06-28T12:00:00Z') });
        const older = makeSettlement({ id: 's1', createdAt: new Date('2026-06-27T10:00:00Z') });
        const newer = makeSettlement({ id: 's2', createdAt: new Date('2026-06-29T10:00:00Z') });
        const result = groupSettlementsForDisplay([batched, older, newer], [batch]);
        expect(result[0].kind).toBe('standalone'); // newer
        expect(result[1].kind).toBe('batch');
        expect(result[2].kind).toBe('standalone'); // older
    });

    it('ignores orphaned batch IDs (no matching batch row)', () => {
        const s = makeSettlement({ consolidationBatchId: 'ghost-batch' });
        const result = groupSettlementsForDisplay([s], []);
        // Falls back to standalone when batch row is missing
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('standalone');
    });
});
