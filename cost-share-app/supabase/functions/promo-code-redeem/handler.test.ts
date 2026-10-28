import { grantPromoProDays } from './handler.ts';

Deno.test('grantPromoProDays skips without API key', async () => {
    const prev = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    Deno.env.delete('REVENUECAT_SECRET_API_KEY');
    try {
        const result = await grantPromoProDays('user-1', 14);
        if (result.ok) throw new Error('expected failure');
        if (result.error !== 'missing_revenuecat_secret') throw new Error(result.error);
    } finally {
        if (prev) Deno.env.set('REVENUECAT_SECRET_API_KEY', prev);
    }
});
