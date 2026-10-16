import { assertEquals } from 'jsr:@std/assert';
import { parseReceiptDraftFromText } from './parse.ts';
import { checkRateLimit, handleReceiptOcr } from './handler.ts';

Deno.test('parseReceiptDraftFromText finds total', () => {
    const d = parseReceiptDraftFromText('Shop\nTOTAL 19.99 USD');
    assertEquals(d.amount, 19.99);
    assertEquals(d.currency, 'USD');
});

Deno.test('handleReceiptOcr rejects missing text without vendor', async () => {
    const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
    };
    const result = await handleReceiptOcr(
        { groupId: 'g1', imageBase64: 'abc' },
        env,
        'fake-jwt',
    );
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.code, 'unauthorized');
});

Deno.test('rate limit allows first call', () => {
    assertEquals(checkRateLimit(`test-user-${Date.now()}`), true);
});
