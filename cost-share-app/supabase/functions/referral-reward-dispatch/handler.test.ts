import { assertEquals } from '@std/assert';
import { dispatchReferralRewards, grantReferralProMonth } from './handler.ts';

Deno.test('grantReferralProMonth skips without API key', async () => {
    const prev = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    Deno.env.delete('REVENUECAT_SECRET_API_KEY');
    try {
        const result = await grantReferralProMonth('user-1');
        assertEquals(result.ok, false);
    } finally {
        if (prev) Deno.env.set('REVENUECAT_SECRET_API_KEY', prev);
    }
});

Deno.test('dispatchReferralRewards applies DB reward before optional RC sync', async () => {
    const prev = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    Deno.env.delete('REVENUECAT_SECRET_API_KEY');
    try {
        const result = await dispatchReferralRewards({
            async fetchQueue() {
                return [
                    {
                        reward_id: 'rw-1',
                        referrer_id: '00000000-0000-4000-8000-000000000099',
                        referee_id: '00000000-0000-4000-8000-000000000088',
                    },
                ];
            },
            async applyReward(rewardId) {
                assertEquals(rewardId, 'rw-1');
                return {
                    ok: true,
                    referrer_id: '00000000-0000-4000-8000-000000000099',
                    pro_until: '2027-01-01T00:00:00.000Z',
                };
            },
        });
        assertEquals(result, { ok: true, queued: 1, granted: 1, failed: 0, rcSyncFailed: 1 });
    } finally {
        if (prev) Deno.env.set('REVENUECAT_SECRET_API_KEY', prev);
    }
});
