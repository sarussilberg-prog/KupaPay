import { buildFeed } from '../../services/feed';
import type { ConsolidationBatch, ExpenseWithSplits, GroupMessage, Settlement } from '@cost-share/shared';

const batch = (
    id: string,
    createdAt: Date,
    groupId = 'g1',
    overrides: Partial<ConsolidationBatch> = {},
): ConsolidationBatch => ({
    id,
    groupId,
    paidByUserId: 'me',
    paidToUserId: 'other',
    paymentAmount: 100,
    paymentCurrency: 'ILS',
    createdAt,
    deletedAt: null,
    ...overrides,
});

const exp = (id: string, createdAt: Date, groupId = 'g1'): ExpenseWithSplits => ({
    id,
    groupId,
    description: `expense ${id}`,
    amount: 10,
    currency: 'USD',
    expenseDate: createdAt,
    paidBy: 'me',
    createdBy: 'me',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
    splits: [
        { id: `${id}-s1`, expenseId: id, userId: 'me', amount: 5, createdAt },
        { id: `${id}-s2`, expenseId: id, userId: 'other', amount: 5, createdAt },
    ],
});

const msg = (id: string, createdAt: Date, groupId = 'g1'): GroupMessage => ({
    id,
    groupId,
    userId: 'me',
    body: `m ${id}`,
    editedAt: null,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
});

const settlement = (id: string, createdAt: Date, groupId = 'g1'): Settlement => ({
    id,
    groupId,
    fromUserId: 'me',
    toUserId: 'other',
    amount: 25,
    currency: 'USD',
    settlementDate: createdAt,
    createdBy: 'me',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
});

describe('buildFeed', () => {
    it('interleaves expenses, messages, and settlements sorted by createdAt DESC', () => {
        const t = (s: string) => new Date(s);
        const feed = buildFeed(
            'g1',
            [exp('e1', t('2026-01-01')), exp('e2', t('2026-01-03'))],
            [msg('m1', t('2026-01-02')), msg('m2', t('2026-01-04'))],
            [settlement('s1', t('2026-01-05'))],
            'me',
        );
        const key = (i: typeof feed[number]) => {
            if (i.kind === 'expense') return `e:${i.expense.id}`;
            if (i.kind === 'settlement') return `s:${i.settlement.id}`;
            if (i.kind === 'consolidation_batch') return `b:${i.batch.id}`;
            return `m:${i.message.id}`;
        };
        expect(feed.map(key)).toEqual([
            's:s1',
            'm:m2',
            'e:e2',
            'm:m1',
            'e:e1',
        ]);
    });

    it('skips expenses from other groups', () => {
        const t = (s: string) => new Date(s);
        const feed = buildFeed(
            'g1',
            [exp('e1', t('2026-01-01'), 'g1'), exp('e2', t('2026-01-02'), 'g2')],
            [],
            [],
            'me',
        );
        expect(feed).toHaveLength(1);
    });

    it('skips deleted messages', () => {
        const t = (s: string) => new Date(s);
        const m = msg('m1', t('2026-01-02'));
        m.isDeleted = true;
        const feed = buildFeed('g1', [], [m], [], 'me');
        expect(feed).toHaveLength(0);
    });

    it('skips soft-deleted settlements and settlements from other groups', () => {
        const t = (s: string) => new Date(s);
        const ok = settlement('s1', t('2026-01-02'));
        const deleted: Settlement = { ...settlement('s2', t('2026-01-03')), deletedAt: new Date() };
        const otherGroup = settlement('s3', t('2026-01-04'), 'g2');
        const feed = buildFeed('g1', [], [], [ok, deleted, otherGroup], 'me');
        expect(feed).toHaveLength(1);
        expect(feed[0].kind).toBe('settlement');
    });

    it('decorates expense items with myDelta', () => {
        const feed = buildFeed('g1', [exp('e1', new Date())], [], [], 'me');
        const item = feed[0];
        if (item.kind !== 'expense') throw new Error('expected expense');
        expect(item.expense.myDelta).toBeCloseTo(5, 2);
        expect(item.expense.myDeltaState).toBe('lent');
    });

    // --- consolidation batch ---

    it('includes batch rows sorted by createdAt', () => {
        const t = (s: string) => new Date(s);
        const feed = buildFeed(
            'g1',
            [],
            [],
            [],
            'me',
            [batch('b1', t('2026-02-01')), batch('b2', t('2026-02-03'))],
        );
        expect(feed).toHaveLength(2);
        expect(feed[0].kind).toBe('consolidation_batch');
        if (feed[0].kind === 'consolidation_batch') expect(feed[0].batch.id).toBe('b2');
    });

    it('always hides settlements with a consolidationBatchId even if the batch is not loaded yet', () => {
        // Race: settlements refetched before batches — the settlement must still be suppressed.
        const t = (s: string) => new Date(s);
        const batchedSettlement: Settlement = {
            ...settlement('s1', t('2026-02-01')),
            consolidationBatchId: 'b1',
        };
        const feed = buildFeed('g1', [], [], [batchedSettlement], 'me', /* no batches */ []);
        expect(feed.filter(i => i.kind === 'settlement')).toHaveLength(0);
    });

    it('links settlements to their batch row when the batch is loaded', () => {
        const t = (s: string) => new Date(s);
        const batchedSettlement: Settlement = {
            ...settlement('s1', t('2026-02-01')),
            consolidationBatchId: 'b1',
        };
        const feed = buildFeed('g1', [], [], [batchedSettlement], 'me', [batch('b1', t('2026-02-02'))]);
        expect(feed).toHaveLength(1);
        expect(feed[0].kind).toBe('consolidation_batch');
        if (feed[0].kind === 'consolidation_batch') {
            expect(feed[0].settlements).toHaveLength(1);
            expect(feed[0].settlements[0].id).toBe('s1');
        }
    });

    it('excludes soft-deleted batches', () => {
        const t = (s: string) => new Date(s);
        const deleted = batch('b1', t('2026-02-01'), 'g1', { deletedAt: new Date() });
        const feed = buildFeed('g1', [], [], [], 'me', [deleted]);
        expect(feed).toHaveLength(0);
    });

    it('excludes batches from other groups', () => {
        const t = (s: string) => new Date(s);
        const otherGroup = batch('b1', t('2026-02-01'), 'g2');
        const feed = buildFeed('g1', [], [], [], 'me', [otherGroup]);
        expect(feed).toHaveLength(0);
    });

    it('non-batched settlements still appear alongside batch rows', () => {
        const t = (s: string) => new Date(s);
        const plain = settlement('s1', t('2026-02-01'));
        const b = batch('b1', t('2026-02-02'));
        const feed = buildFeed('g1', [], [], [plain], 'me', [b]);
        expect(feed).toHaveLength(2);
        expect(feed.some(i => i.kind === 'settlement')).toBe(true);
        expect(feed.some(i => i.kind === 'consolidation_batch')).toBe(true);
    });
});
