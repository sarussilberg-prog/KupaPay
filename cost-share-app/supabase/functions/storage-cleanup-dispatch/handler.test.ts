import { assertEquals } from '@std/assert';
import { verifyCronWebhookSecret } from '../cron-webhook/auth.ts';
import { dispatchStorageCleanup } from './handler.ts';

Deno.test('verifyCronWebhookSecret accepts exact cron secret', () => {
    assertEquals(verifyCronWebhookSecret('cron-secret', 'cron-secret'), true);
    assertEquals(verifyCronWebhookSecret('wrong', 'cron-secret'), false);
});

Deno.test('dispatchStorageCleanup marks rows processed after successful remove', async () => {
    const processed: string[] = [];
    const result = await dispatchStorageCleanup({
        listPending: async () => [
            { id: 'a', bucket: 'profile-images', object_path: 'u1/a.jpg' },
        ],
        removeObjects: async (bucket, paths) => {
            assertEquals(bucket, 'profile-images');
            assertEquals(paths, ['u1/a.jpg']);
            return {};
        },
        markProcessed: async (id) => {
            processed.push(id);
        },
        markFailed: async () => {},
    });
    assertEquals(result, { processed: 1, failed: 0 });
    assertEquals(processed, ['a']);
});

Deno.test('dispatchStorageCleanup marks failed when storage remove errors', async () => {
    const failed: Array<{ id: string; error: string }> = [];
    const result = await dispatchStorageCleanup({
        listPending: async () => [
            { id: 'b', bucket: 'expense-receipts', object_path: 'g1/r.jpg' },
        ],
        removeObjects: async () => ({ error: 'not_found' }),
        markProcessed: async () => {},
        markFailed: async (id, error) => {
            failed.push({ id, error });
        },
    });
    assertEquals(result, { processed: 0, failed: 1 });
    assertEquals(failed, [{ id: 'b', error: 'not_found' }]);
});
