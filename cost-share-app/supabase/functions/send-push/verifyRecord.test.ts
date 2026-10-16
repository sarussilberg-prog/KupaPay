import { assertEquals } from '@std/assert';
import { activityRecordMatchesRow } from './verifyRecord.ts';
import type { ActivityRecord } from './handler.ts';

const base: ActivityRecord = {
    id: 'evt-1',
    user_id: 'u-recipient',
    kind: 'expense_added',
    group_id: 'g-1',
    ref_id: 'x-1',
    actor_user_id: 'u-actor',
    metadata: { amount: 10 },
    created_at: '2026-06-11T10:00:00Z',
};

Deno.test('activityRecordMatchesRow accepts identical row', () => {
    assertEquals(activityRecordMatchesRow(base, { ...base }), true);
});

Deno.test('activityRecordMatchesRow rejects tampered user_id', () => {
    assertEquals(
        activityRecordMatchesRow(base, { ...base, user_id: 'other' }),
        false,
    );
});

Deno.test('activityRecordMatchesRow rejects tampered metadata', () => {
    assertEquals(
        activityRecordMatchesRow(base, { ...base, metadata: { amount: 99 } }),
        false,
    );
});
