import { createClient } from 'npm:@supabase/supabase-js@2';
import { dispatchProTrialReminders } from './handler.ts';
import { sendExpoPush } from '../send-push/expo.ts';

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

    const now = new Date();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    try {
        const result = await dispatchProTrialReminders(
            {
                async listDueReminders(clock) {
                    const windowStart = new Date(clock.getTime() + twoDaysMs - 12 * 60 * 60 * 1000);
                    const windowEnd = new Date(clock.getTime() + twoDaysMs + 12 * 60 * 60 * 1000);
                    const { data, error } = await sb
                        .from('profiles')
                        .select('id, language')
                        .not('pro_trial_ends_at', 'is', null)
                        .is('pro_trial_reminder_sent_at', null)
                        .gte('pro_trial_ends_at', windowStart.toISOString())
                        .lte('pro_trial_ends_at', windowEnd.toISOString());
                    if (error) throw error;
                    return (data ?? []) as Array<{ id: string; language: string | null }>;
                },
                async loadActiveTokens(userId) {
                    const { data } = await sb.from('device_tokens')
                        .select('token')
                        .eq('user_id', userId)
                        .is('disabled_at', null);
                    return (data ?? []) as Array<{ token: string }>;
                },
                async markReminderSent(userId) {
                    await sb.from('profiles')
                        .update({ pro_trial_reminder_sent_at: new Date().toISOString() })
                        .eq('id', userId);
                },
                async sendExpo(messages) {
                    await sendExpoPush(messages);
                },
            },
            now,
        );
        return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('pro-trial-reminder-dispatch failed', e);
        return new Response(JSON.stringify({ ok: false, error: 'internal' }), { status: 500 });
    }
});
