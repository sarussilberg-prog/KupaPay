import { assertEquals } from 'jsr:@std/assert';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { parseReceiptDraftFromText } from '../../../packages/shared/src/receiptOcr/parseReceiptDraftFromText.ts';
import {
    consumeReceiptOcrQuota,
    handleReceiptOcr,
    RECEIPT_OCR_QUOTA_RPC,
} from './handler.ts';

Deno.test('parseReceiptDraftFromText finds total', () => {
    const d = parseReceiptDraftFromText('Shop\nTOTAL 19.99 USD');
    assertEquals(d.amount, 19.99);
    assertEquals(d.currency, 'USD');
});

Deno.test('handleReceiptOcr rejects missing text without vendor', async () => {
    const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
    };
    const result = await handleReceiptOcr(
        { groupId: 'g1', imageBase64: 'abc' },
        env,
        'fake-jwt',
    );
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.code, 'unauthorized');
});

Deno.test('consumeReceiptOcrQuota calls consume_receipt_ocr_quota_for_user', async () => {
    let rpcName = '';
    let rpcArgs: Record<string, unknown> | undefined;
    const mockClient = {
        rpc(name: string, args: Record<string, unknown>) {
            rpcName = name;
            rpcArgs = args;
            return Promise.resolve({ data: true, error: null });
        },
    } as unknown as SupabaseClient;

    const result = await consumeReceiptOcrQuota(mockClient, 'user-123');
    assertEquals(result.ok, true);
    assertEquals(rpcName, RECEIPT_OCR_QUOTA_RPC);
    assertEquals(rpcArgs, { p_user_id: 'user-123' });
});

Deno.test('handleReceiptOcr validates payload before consumeReceiptOcrQuota (#350)', () => {
    const src = Deno.readTextFileSync(new URL('./handler.ts', import.meta.url));
    const textRequired = src.indexOf("code: 'text_required'");
    const quotaCall = src.indexOf('await consumeReceiptOcrQuota(');
    assertEquals(textRequired > 0 && quotaCall > textRequired, true);
});

Deno.test('consumeReceiptOcrQuota surfaces quota_exceeded when RPC returns false', async () => {
    const mockClient = {
        rpc() {
            return Promise.resolve({ data: false, error: null });
        },
    } as unknown as SupabaseClient;

    const result = await consumeReceiptOcrQuota(mockClient, 'user-123');
    assertEquals(result.ok, false);
    assertEquals(result.error, 'quota_exceeded');
});
