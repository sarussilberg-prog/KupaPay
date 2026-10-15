import { createClient } from 'supabase';
import { dispatchSmartPaymentReminders } from './handler.ts';

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
        const result = await dispatchSmartPaymentReminders({
            async runDispatch() {
                const { data, error } = await sb.rpc('run_smart_payment_reminders');
                if (error) throw error;
                const row = (data ?? {}) as { sent?: number; skipped?: number };
                return { sent: row.sent ?? 0, skipped: row.skipped ?? 0 };
            },
        });
        return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('pro-smart-reminder-dispatch failed', e);
        return new Response(JSON.stringify({ ok: false, error: 'internal' }), { status: 500 });
    }
});
