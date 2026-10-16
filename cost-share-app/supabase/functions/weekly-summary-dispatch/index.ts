import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchWeeklySummary } from './handler.ts';
import { sendExpoPush } from '../send-push/expo.ts';

const SECRET_ENV = 'WEEKLY_SUMMARY_WEBHOOK_SECRET';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret(SECRET_ENV));
    if (denied) return denied;

    const sb = createServiceSupabase();

    try {
        const result = await dispatchWeeklySummary({
            async fetchBatch() {
                const { data, error } = await sb.rpc('run_weekly_summary_dispatch', { p_limit: 300 });
                if (error) throw error;
                const payload = (data ?? {}) as { week_start?: string; items?: WeeklyDigestItem[] };
                return {
                    week_start: String(payload.week_start ?? ''),
                    items: Array.isArray(payload.items) ? payload.items : [],
                };
            },
            async loadActiveTokens(userId) {
                const { data } = await sb.from('device_tokens')
                    .select('token')
                    .eq('user_id', userId)
                    .is('disabled_at', null);
                return (data ?? []) as Array<{ token: string }>;
            },
            async markSent(userId, weekStart) {
                const { error } = await sb.rpc('mark_weekly_summary_sent', {
                    p_user_id: userId,
                    p_week_start: weekStart,
                });
                if (error) throw error;
            },
            async sendExpo(messages) {
                await sendExpoPush(messages);
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('weekly-summary-dispatch failed', e);
    }
});

type WeeklyDigestItem = import('./handler.ts').WeeklyDigestItem;
