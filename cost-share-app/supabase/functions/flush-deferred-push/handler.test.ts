import { assertEquals } from '@std/assert';
import { flushDeferredPushes, type FlushDeps } from './handler.ts';

function makeDeps(over: Partial<FlushDeps> = {}): FlushDeps {
    return {
        listDeferred: () => Promise.resolve([]),
        loadEvent: () => Promise.resolve(null),
        resetDeferred: () => Promise.resolve(),
        supabaseUrl: 'https://example.supabase.co',
        serviceRole: 'service-key',
        ...over,
    };
}

Deno.test('flushDeferredPushes returns zero when queue empty', async () => {
    const out = await flushDeferredPushes(makeDeps());
    assertEquals(out, { flushed: 0 });
});

Deno.test('flushDeferredPushes skips missing activity rows', async () => {
    const out = await flushDeferredPushes(makeDeps({
        listDeferred: () => Promise.resolve(['missing-id']),
        loadEvent: () => Promise.resolve(null),
    }));
    assertEquals(out, { flushed: 0 });
});
