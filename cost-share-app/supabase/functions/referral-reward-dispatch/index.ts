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
            async applyReward(rewardId) {
                const { data, error } = await sb.rpc('apply_referral_reward', {
                    p_reward_id: rewardId,
                });
                if (error) throw error;
                const row = (data ?? {}) as {
                    ok?: boolean;
                    referrer_id?: string;
                    pro_until?: string;
                    error?: string;
                };
                if (row.ok === true && row.referrer_id) {
                    return { ok: true, referrer_id: row.referrer_id, pro_until: row.pro_until };
                }
                return { ok: false, error: row.error };
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('referral-reward-dispatch failed', e);
    }
});
