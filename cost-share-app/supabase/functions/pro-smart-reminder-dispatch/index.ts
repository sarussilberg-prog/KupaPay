import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchSmartPaymentReminders } from './handler.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret());
    if (denied) return denied;

    const sb = createServiceSupabase();

    try {
        const result = await dispatchSmartPaymentReminders({
            async run(limit) {
                const { data, error } = await sb.rpc('run_smart_payment_reminders', {
                    p_limit: limit,
                });
                if (error) throw error;
                return (data ?? {}) as Record<string, unknown>;
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('pro-smart-reminder-dispatch failed', e);
    }
});
