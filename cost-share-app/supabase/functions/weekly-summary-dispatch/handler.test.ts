import { assertEquals } from '@std/assert';
import { dispatchWeeklySummary } from './handler.ts';

Deno.test('dispatchWeeklySummary marks sent even without tokens', async () => {
    let marked = false;
    const result = await dispatchWeeklySummary({
        async fetchBatch() {
            return {
                week_start: '2026-10-13',
                items: [{
                    user_id: 'u1',
                    email: null,
                    language: 'en',
                    unsubscribe_token: 'tok',
                    send_push: true,
                    send_email: false,
                    stats: { total_owe: 1, total_owed: 2, top_group_name: 'Trip' },
                }],
            };
        },
        async loadActiveTokens() {
            return [];
        },
        async markSent() {
            marked = true;
        },
        async sendExpo() {
            throw new Error('no push');
        },
    });
    assertEquals(marked, true);
    assertEquals(result.recipients, 1);
});
