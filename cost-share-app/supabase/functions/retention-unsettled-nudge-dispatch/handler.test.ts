import { assertEquals } from '@std/assert';
import { dispatchRetentionUnsettledNudges } from './handler.ts';

Deno.test('dispatchRetentionUnsettledNudges merges rpc result', async () => {
    const out = await dispatchRetentionUnsettledNudges({
        run: async (limit) => ({ ok: true, sent: 2, limit }),
    }, 50);
    assertEquals(out, { ok: true, sent: 2, limit: 50 });
});
