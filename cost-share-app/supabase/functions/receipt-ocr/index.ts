import { jsonResponse, preflight } from '../send-push/cors.ts';
import { bearerJwt, handleReceiptOcr, type ReceiptOcrEnv } from './handler.ts';

function env(): ReceiptOcrEnv {
    return {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        RECEIPT_OCR_API_URL: Deno.env.get('RECEIPT_OCR_API_URL'),
        RECEIPT_OCR_API_KEY: Deno.env.get('RECEIPT_OCR_API_KEY'),
    };
}

Deno.serve(async (req) => {
    const pre = preflight(req);
    if (pre) return pre;

    if (req.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const jwt = bearerJwt(req);
    if (!jwt) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

    let body: { groupId?: string; text?: string; imageBase64?: string };
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }

    const e = env();
    if (!e.SUPABASE_URL || !e.SUPABASE_ANON_KEY || !e.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse({ ok: false, error: 'misconfigured' }, 500);
    }

    const result = await handleReceiptOcr(
        {
            groupId: body.groupId ?? '',
            text: body.text,
            imageBase64: body.imageBase64,
        },
        e,
        jwt,
    );

    if (!result.ok) {
        const status =
            result.code === 'unauthorized' || result.code === 'pro_required'
                ? 403
                : result.code === 'rate_limited'
                    ? 429
                    : 400;
        return jsonResponse(result, status);
    }

    return jsonResponse(result, 200);
});
