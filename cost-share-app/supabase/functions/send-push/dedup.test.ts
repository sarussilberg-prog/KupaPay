import { assertEquals } from '@std/assert';
import { classifyDelivery } from './dedup.ts';

const T0 = '2026-06-22T10:00:00.000Z';
const T1 = '2026-06-22T10:05:00.000Z';

Deno.test('no existing row → new', () => {
    assertEquals(classifyDelivery(null, T0), 'new');
});

Deno.test('same revision already sent → duplicate', () => {
    assertEquals(classifyDelivery({ status: 'sent', event_created_at: T0 }, T0), 'duplicate');
});

Deno.test('same revision in-flight (pending) → duplicate', () => {
    assertEquals(classifyDelivery({ status: 'pending', event_created_at: T0 }, T0), 'duplicate');
});

Deno.test('same revision previously failed → new (retryable)', () => {
    assertEquals(classifyDelivery({ status: 'failed', event_created_at: T0 }, T0), 'new');
});

Deno.test('same revision previously skipped → new (re-evaluate)', () => {
    assertEquals(classifyDelivery({ status: 'skipped', event_created_at: T0 }, T0), 'new');
});

Deno.test('newer revision after a sent push (edit/delete) → revised', () => {
    assertEquals(classifyDelivery({ status: 'sent', event_created_at: T0 }, T1), 'revised');
});

Deno.test('newer revision even while prior is pending → revised', () => {
    assertEquals(classifyDelivery({ status: 'pending', event_created_at: T0 }, T1), 'revised');
});

Deno.test('older/stale trigger delivery (incoming behind recorded revision) → duplicate', () => {
    assertEquals(classifyDelivery({ status: 'sent', event_created_at: T1 }, T0), 'duplicate');
});
