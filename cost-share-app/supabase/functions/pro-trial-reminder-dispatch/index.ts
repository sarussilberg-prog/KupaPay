import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchProTrialReminders } from './handler.ts';
import { sendExpoPush } from '../send-push/expo.ts';

const TRIAL_SECRET_ENV = 'PRO_TRIAL_REMINDER_WEBHOOK_SECRET';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret(TRIAL_SECRET_ENV));
    if (denied) return denied;

    const sb = createServiceSupabase();
    const now = new Date();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    try {
        const result = await dispatchProTrialReminders(
            {
                async listDueReminders(clock) {
                    const windowStart = new Date(clock.getTime() + twoDaysMs - 12 * 60 * 60 * 1000);
                    const windowEnd = new Date(clock.getTime() + twoDaysMs + 12 * 60 * 60 * 1000);
                    const { data, error } = await sb
                        .from('profiles')
                        .select('id, language')
                        .not('pro_trial_ends_at', 'is', null)
                        .is('pro_trial_reminder_sent_at', null)
                        .gte('pro_trial_ends_at', windowStart.toISOString())
                        .lte('pro_trial_ends_at', windowEnd.toISOString());
                    if (error) throw error;
                    return (data ?? []) as Array<{ id: string; language: string | null }>;
                },
                async loadActiveTokens(userId) {
                    const { data } = await sb.from('device_tokens')
                        .select('token')
                        .eq('user_id', userId)
                        .is('disabled_at', null);
                    return (data ?? []) as Array<{ token: string }>;
                },
                async markReminderSent(userId) {
                    await sb.from('profiles')
                        .update({ pro_trial_reminder_sent_at: new Date().toISOString() })
                        .eq('id', userId);
                },
                async sendExpo(messages) {
                    await sendExpoPush(messages);
                },
            },
            now,
        );
        return jsonOk({ ok: true, ...result });
    } catch (e) {
        return jsonInternalError('pro-trial-reminder-dispatch failed', e);
    }
});
