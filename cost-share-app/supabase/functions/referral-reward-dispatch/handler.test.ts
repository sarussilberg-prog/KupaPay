import { assertEquals } from '@std/assert';
import { grantReferralProMonth } from './handler.ts';

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
