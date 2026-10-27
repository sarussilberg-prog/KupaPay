import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchRetentionUnsettledNudges } from './handler.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret('RETENTION_UNSETTLED_NUDGE_WEBHOOK_SECRET'));
    if (denied) return denied;

    const sb = createServiceSupabase();

    try {
        const result = await dispatchRetentionUnsettledNudges({
            async run(limit) {
                const { data, error } = await sb.rpc('run_retention_unsettled_nudges', { p_limit: limit });
                if (error) throw error;
                return (data ?? {}) as Record<string, unknown>;
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('retention-unsettled-nudge-dispatch failed', e);
    }
});
