import { assertEquals } from '@std/assert';
import { dispatchProTrialReminders } from './handler.ts';

Deno.test('dispatchProTrialReminders skips users with no push tokens', async () => {
    const result = await dispatchProTrialReminders({
        listDueReminders: async () => [{ id: 'user-1', language: 'en' }],
        loadActiveTokens: async () => [],
        markReminderSent: async () => {},
        sendExpo: async () => {},
    });
    assertEquals(result, { sent: 0, skipped: 1 });
});

Deno.test('dispatchProTrialReminders sends Hebrew copy for he language', async () => {
    let title = '';
    const result = await dispatchProTrialReminders({
        listDueReminders: async () => [{ id: 'user-2', language: 'he' }],
        loadActiveTokens: async () => [{ token: 'ExponentPushToken[test]' }],
        markReminderSent: async () => {},
        sendExpo: async messages => {
            title = messages[0]?.title ?? '';
        },
    });
    assertEquals(result.sent, 1);
    assertEquals(title, 'ניסיון KupaPay Pro מסתיים בקרוב');
});
