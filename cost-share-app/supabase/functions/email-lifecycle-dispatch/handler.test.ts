import { assertEquals } from '@std/assert';
import { dispatchEmailLifecycle } from './handler.ts';

Deno.test('dispatchEmailLifecycle skips send when provider not configured', async () => {
    const prev = Deno.env.get('RESEND_API_KEY');
    Deno.env.delete('RESEND_API_KEY');
    try {
        const result = await dispatchEmailLifecycle({
            async fetchQueue() {
                return [{
                    user_id: 'u1',
                    email: 'a@test.local',
                    language: 'en',
                    template: 'welcome',
                    unsubscribe_token: 'tok',
                }];
            },
            async markSent() {
                throw new Error('should not mark sent');
            },
        });
        assertEquals(result.providerConfigured, false);
        assertEquals(result.sent, 0);
    } finally {
        if (prev) Deno.env.set('RESEND_API_KEY', prev);
    }
});
