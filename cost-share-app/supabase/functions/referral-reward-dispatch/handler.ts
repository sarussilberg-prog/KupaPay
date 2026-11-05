/** Grant 1-month Pro promotional entitlement via RevenueCat REST API (#400). */

export interface ReferralRewardItem {
    reward_id: string;
    referrer_id: string;
    referee_id: string;
}

export async function grantReferralProMonth(appUserId: string): Promise<{ ok: boolean; error?: string }> {
    const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY')?.trim();
    if (!apiKey) {
        return { ok: false, error: 'missing_revenuecat_secret' };
    }
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/pro/promotional`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            duration: 'monthly',
            duration_count: 1,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `rc_${res.status}:${text.slice(0, 160)}` };
    }
    return { ok: true };
}

export type ApplyReferralRewardResult =
    | { ok: true; referrer_id: string; pro_until?: string }
    | { ok: false; error?: string };

export async function dispatchReferralRewards(deps: {
    fetchQueue(): Promise<ReferralRewardItem[]>;
    applyReward(rewardId: string): Promise<ApplyReferralRewardResult>;
}): Promise<Record<string, unknown>> {
    const items = await deps.fetchQueue();
    let granted = 0;
    let failed = 0;
    let rcSyncFailed = 0;

    for (const item of items) {
        const applied = await deps.applyReward(item.reward_id);
        if (!applied.ok) {
            failed += 1;
            continue;
        }
        granted += 1;
        const rc = await grantReferralProMonth(applied.referrer_id);
        if (!rc.ok) rcSyncFailed += 1;
    }

    return { ok: true, queued: items.length, granted, failed, rcSyncFailed };
}
