import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../send-push/cors.ts';
import { handlePromoCodeRedeemSync, type PromoRedeemEnv } from './handler.ts';

function env(): PromoRedeemEnv {
    return {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        REVENUECAT_SECRET_API_KEY: Deno.env.get('REVENUECAT_SECRET_API_KEY'),
    };
}

Deno.serve(async (req) => {
    const pre = preflight(req);
    if (pre) return pre;

    if (req.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }

    const e = env();
    if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse({ ok: false, error: 'misconfigured' }, 500);
    }

    const anon = createClient(e.SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData.user?.id) {
        return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }

    let body: { redemption_id?: string };
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }

    const redemptionId = body.redemption_id?.trim();
    if (!redemptionId) {
        return jsonResponse({ ok: false, error: 'missing_redemption_id' }, 400);
    }

    const result = await handlePromoCodeRedeemSync(
        { redemptionId, userId: userData.user.id },
        e,
    );

    if (!result.ok) {
        const status = result.code === 'redemption_not_found' ? 404 : 502;
        return jsonResponse(result, status);
    }

    return jsonResponse({ ok: true }, 200);
});
