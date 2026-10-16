import { assertEquals } from '@std/assert';
import { verifyCronWebhookSecret } from '../cron-webhook/auth.ts';

Deno.test('send-push webhook secret uses timing-safe comparison', () => {
    assertEquals(verifyCronWebhookSecret('push-secret', 'push-secret'), true);
    assertEquals(verifyCronWebhookSecret('push-secrex', 'push-secret'), false);
    assertEquals(verifyCronWebhookSecret(null, 'push-secret'), false);
    assertEquals(verifyCronWebhookSecret('x', ''), false);
});
