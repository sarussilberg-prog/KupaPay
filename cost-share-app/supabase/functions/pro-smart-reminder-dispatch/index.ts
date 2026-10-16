import { createClient } from 'npm:@supabase/supabase-js@2';

const PUSH_WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
    }
    if (!PUSH_WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== PUSH_WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
        const { data, error } = await sb.rpc('run_smart_payment_reminders', { p_limit: 100 });
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true, ...(data as object) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('pro-smart-reminder-dispatch failed', e);
        return new Response(JSON.stringify({ ok: false, error: 'internal' }), { status: 500 });
    }
});
