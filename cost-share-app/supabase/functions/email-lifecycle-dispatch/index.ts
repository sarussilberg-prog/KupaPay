import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchEmailLifecycle } from './handler.ts';

const SECRET_ENV = 'EMAIL_LIFECYCLE_WEBHOOK_SECRET';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret(SECRET_ENV));
    if (denied) return denied;

    const sb = createServiceSupabase();

    try {
        const result = await dispatchEmailLifecycle({
            async fetchQueue(limit) {
                const { data, error } = await sb.rpc('run_email_lifecycle_dispatch', { p_limit: limit });
                if (error) throw error;
                const payload = (data ?? {}) as { items?: unknown };
                const raw = payload.items;
                if (Array.isArray(raw)) return raw as LifecycleQueueItem[];
                return [];
            },
            async markSent(userId, template) {
                const { error } = await sb.rpc('mark_email_lifecycle_sent', {
                    p_user_id: userId,
                    p_template: template,
                });
                if (error) throw error;
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('email-lifecycle-dispatch failed', e);
    }
});

type LifecycleQueueItem = {
    user_id: string;
    email: string;
    language: string;
    template: string;
    unsubscribe_token: string;
};
