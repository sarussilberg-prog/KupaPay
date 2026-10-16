import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchReferralRewards } from './handler.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret('REFERRAL_REWARD_WEBHOOK_SECRET'));
    if (denied) return denied;

    const sb = createServiceSupabase();
    try {
        const result = await dispatchReferralRewards({
            async fetchQueue() {
                const { data, error } = await sb.rpc('run_referral_reward_dispatch', { p_limit: 50 });
                if (error) throw error;
                const payload = (data ?? {}) as { items?: unknown };
                return Array.isArray(payload.items)
                    ? payload.items as import('./handler.ts').ReferralRewardItem[]
                    : [];
            },
            async markRewarded(rewardId, ok, reason) {
                const { error } = await sb.rpc('mark_referral_rewarded', {
                    p_reward_id: rewardId,
                    p_ok: ok,
                    p_reason: reason ?? null,
                });
                if (error) throw error;
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('referral-reward-dispatch failed', e);
    }
});
