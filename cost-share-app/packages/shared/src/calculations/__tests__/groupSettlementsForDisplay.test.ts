import { groupSettlementsForDisplay } from '../groupSettlementsForDisplay';
import type { Settlement, ConsolidationBatch } from '../../types';

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

describe('groupSettlementsForDisplay (shared package)', () => {
    it('returns empty array for no settlements', () => {
        expect(groupSettlementsForDisplay([], [])).toEqual([]);
    });

    it('groups multiple settlements under one batch entry', () => {
        const batch = makeBatch();
        const s1 = makeSettlement({ id: 's1', consolidationBatchId: 'batch-1', amount: 40 });
        const s2 = makeSettlement({ id: 's2', consolidationBatchId: 'batch-1', amount: 60 });
        const result = groupSettlementsForDisplay([s1, s2], [batch]);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('batch');
        if (result[0].kind === 'batch') {
            expect(result[0].settlements.map(s => s.id).sort()).toEqual(['s1', 's2']);
        }
    });

    it('uses batch.createdAt for sort order even when member settlements differ', () => {
        const batch = makeBatch({ createdAt: new Date('2026-06-30T12:00:00Z') });
        const batched = makeSettlement({
            id: 'b1',
            consolidationBatchId: 'batch-1',
            createdAt: new Date('2026-06-25T08:00:00Z'),
        });
        const newerStandalone = makeSettlement({
            id: 's-new',
            createdAt: new Date('2026-06-29T08:00:00Z'),
        });
        const result = groupSettlementsForDisplay([batched, newerStandalone], [batch]);
        expect(result[0].kind).toBe('batch');
        expect(result[1].kind).toBe('standalone');
    });

    it('treats consolidationBatchId pointing at missing batch as standalone', () => {
        const orphan = makeSettlement({ consolidationBatchId: 'missing-batch' });
        const result = groupSettlementsForDisplay([orphan], [makeBatch({ id: 'other' })]);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('standalone');
    });

    it('sorts two batches by createdAt descending', () => {
        const older = makeBatch({ id: 'b-old', createdAt: new Date('2026-06-20T10:00:00Z') });
        const newer = makeBatch({ id: 'b-new', createdAt: new Date('2026-06-25T10:00:00Z') });
        const sOld = makeSettlement({ id: 's-old', consolidationBatchId: 'b-old' });
        const sNew = makeSettlement({ id: 's-new', consolidationBatchId: 'b-new' });
        const result = groupSettlementsForDisplay([sOld, sNew], [older, newer]);
        expect(result).toHaveLength(2);
        expect(result[0].kind).toBe('batch');
        if (result[0].kind === 'batch') {
            expect(result[0].batch.id).toBe('b-new');
        }
    });
});
