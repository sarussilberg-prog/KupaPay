import { createClient } from 'npm:@supabase/supabase-js@2';

export function cronWebhookSecret(envVar = 'CRON_DISPATCH_WEBHOOK_SECRET'): string {
    return Deno.env.get(envVar) ?? '';
}

export function assertCronPost(req: Request, secret: string): Response | null {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
            status: 405,
        });
    }
    if (!secret || req.headers.get('x-webhook-secret') !== secret) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
    }
    return null;
}

export function createServiceSupabase() {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

export function jsonOk(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function jsonInternalError(logLabel: string, e: unknown): Response {
    console.error(logLabel, e);
    return jsonOk({ ok: false, error: 'internal' }, 500);
}
