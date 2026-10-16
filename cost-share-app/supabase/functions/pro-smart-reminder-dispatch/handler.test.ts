import { assertEquals } from 'jsr:@std/assert';
import { dispatchSmartPaymentReminders } from './handler.ts';

Deno.test('dispatchSmartPaymentReminders wraps RPC result', async () => {
    const out = await dispatchSmartPaymentReminders({
        async run() {
            return { sent: 2 };
        },
    });
    assertEquals(out, { ok: true, sent: 2 });
});
