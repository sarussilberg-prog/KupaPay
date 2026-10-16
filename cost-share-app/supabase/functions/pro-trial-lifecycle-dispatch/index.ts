import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchProTrialLifecycle } from './handler.ts';
import { sendExpoPush } from '../send-push/expo.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret('PRO_TRIAL_LIFECYCLE_WEBHOOK_SECRET'));
    if (denied) return denied;

    const sb = createServiceSupabase();
    try {
        const result = await dispatchProTrialLifecycle({
            async fetchItems() {
                const { data, error } = await sb.rpc('run_pro_trial_lifecycle_dispatch', { p_limit: 200 });
                if (error) throw error;
                const payload = (data ?? {}) as { items?: unknown };
                return Array.isArray(payload.items)
                    ? payload.items as import('./handler.ts').LifecyclePushItem[]
                    : [];
            },
            async loadTokens(userId) {
                const { data } = await sb
                    .from('device_tokens')
                    .select('token')
                    .eq('user_id', userId)
                    .is('disabled_at', null);
                return (data ?? []) as Array<{ token: string }>;
            },
            async markSent(userId, day) {
                const { error } = await sb.rpc('mark_pro_trial_lifecycle_sent_service', {
                    p_user_id: userId,
                    p_day: day,
                });
                if (error) throw error;
            },
            async sendExpo(messages) {
                await sendExpoPush(messages);
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('pro-trial-lifecycle-dispatch failed', e);
    }
});
