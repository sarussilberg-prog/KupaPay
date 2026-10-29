import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchProTrialLifecycle } from './handler.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret('PRO_TRIAL_LIFECYCLE_WEBHOOK_SECRET'));
    if (denied) return denied;

    const sb = createServiceSupabase();
    const limit = Number(new URL(req.url).searchParams.get('limit') ?? '200');

    try {
        const result = await dispatchProTrialLifecycle({
            async run(pLimit) {
                const { data, error } = await sb.rpc('run_pro_trial_lifecycle_dispatch', {
                    p_limit: pLimit,
                });
                if (error) throw error;
                return (data ?? {}) as Record<string, unknown>;
            },
        }, limit);
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('pro-trial-lifecycle-dispatch failed', e);
    }
});
