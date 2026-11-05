/**
 * RevenueCat webhook → Supabase entitlement writes (idempotent via handle_revenuecat_webhook RPC).
 * Store-agnostic: App Store and Google Play events share product ids (`kupapay_pro_*`, `kupapay_trip_pass`).
 * @see docs/KUPAPAY_PRO_SETUP.md
 */

import {
    planRevenueCatWebhookRpc,
    proUntilFromEvent,
    shouldApplySandboxRevenueCatEvent,
    tripPassUntilFromEvent,
    isTripPassProduct,
    PRODUCT_PRO_MONTHLY,
    PRODUCT_PRO_YEARLY,
    PRODUCT_TRIP_PASS,
    PRO_ENTITLEMENT_ID,
    type RevenueCatWebhookEvent,
} from '../../../packages/shared/src/revenuecat/revenueCatWebhookLogic.ts';

export {
    proUntilFromEvent,
    tripPassUntilFromEvent,
    isTripPassProduct,
    PRODUCT_PRO_MONTHLY,
    PRODUCT_PRO_YEARLY,
    PRODUCT_TRIP_PASS,
    PRO_ENTITLEMENT_ID,
};

export interface WebhookEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    REVENUECAT_WEBHOOK_SECRET: string;
    /** When `true`, all SANDBOX events apply. When false, only `revenuecat_test_user` profiles on prod. */
    REVENUECAT_ALLOW_SANDBOX_EVENTS?: string;
}

export type RevenueCatEvent = RevenueCatWebhookEvent;

export interface RevenueCatWebhookBody {
    api_version?: string;
    event: RevenueCatEvent;
}

function readAttr(event: RevenueCatEvent, key: string): string | null {
    const raw = event.subscriber_attributes?.[key]?.value;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    return raw.trim();
}

function parseUuid(value: string | null): string | null {
    if (!value) return null;
    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuid.test(value) ? value : null;
}

function timingSafeEqualString(provided: string, expected: string): boolean {
    const enc = new TextEncoder();
    const a = enc.encode(provided);
    const b = enc.encode(expected);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export function verifyAuthorization(req: Request, secret: string): boolean {
    if (!secret) return false;
    const auth = req.headers.get('authorization') ?? '';
    if (auth.length > 0 && timingSafeEqualString(auth, secret)) return true;
    const bearerPrefix = 'Bearer ';
    if (
        auth.length > bearerPrefix.length &&
        auth.slice(0, bearerPrefix.length).toLowerCase() === bearerPrefix.toLowerCase()
    ) {
        return timingSafeEqualString(auth.slice(bearerPrefix.length).trim(), secret);
    }
    return false;
}

async function fetchIsRevenueCatTestUser(userId: string, env: WebhookEnv): Promise<boolean> {
    const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/is_revenuecat_test_user`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_user_id: userId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data === true;
}

export type WebhookAction =
    | 'individual'
    | 'trip_pass'
    | 'trip_pass_unassigned'
    | 'yearly_credit'
    | 'ignored';

export type HandleOutcome =
    | { ok: true; action: WebhookAction; duplicate?: boolean; sandboxIgnored?: boolean }
    | { ok: false; status: number; error: string };

export async function applyWebhookEvent(
    body: RevenueCatWebhookBody,
    env: WebhookEnv,
): Promise<HandleOutcome> {
    const event = body.event;
    if (!event?.app_user_id || !event.id) {
        return { ok: false, status: 400, error: 'missing_event' };
    }

    const userId = parseUuid(event.app_user_id);
    if (!userId) {
        return { ok: false, status: 400, error: 'invalid_app_user_id' };
    }

    const allowSandbox = env.REVENUECAT_ALLOW_SANDBOX_EVENTS === 'true';
    if (event.environment === 'SANDBOX' && !allowSandbox) {
        const isTestUser = await fetchIsRevenueCatTestUser(userId, env);
        if (!shouldApplySandboxRevenueCatEvent(event.environment, allowSandbox, isTestUser)) {
            return { ok: true, action: 'ignored', sandboxIgnored: true };
        }
    }

    const plan = planRevenueCatWebhookRpc(event);
    if (plan.kind === 'ignore') {
        return { ok: true, action: 'ignored' };
    }

    const type = event.type ?? '';
    const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/handle_revenuecat_webhook`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            p_event_id: event.id,
            p_user_id: userId,
            p_event_type: type,
            p_product_id: event.product_id ?? null,
            p_pro_until: plan.p_pro_until,
            p_trip_pass_until: plan.p_trip_pass_until,
            p_attr_group_id: parseUuid(readAttr(event, 'group_id')),
            p_is_trip_pass: plan.p_is_trip_pass,
            p_is_yearly: plan.p_is_yearly,
            p_is_immediate_pro_revoke: plan.p_is_immediate_pro_revoke,
            p_is_trip_pass_revoke: plan.p_is_trip_pass_revoke,
            p_event_timestamp_ms: plan.p_event_timestamp_ms,
        }),
    });

    if (!res.ok) {
        return { ok: false, status: 502, error: 'webhook_rpc_failed' };
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data.duplicate === true) {
        return { ok: true, action: 'ignored', duplicate: true };
    }
    if (data.stale === true) {
        return { ok: true, action: 'ignored' };
    }
    const action = (data.action as WebhookAction) ?? 'ignored';
    return { ok: true, action };
}

export async function handleRequest(req: Request, env: WebhookEnv): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
            },
        });
    }
    if (req.method !== 'POST') {
        return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    }
    if (!verifyAuthorization(req, env.REVENUECAT_WEBHOOK_SECRET)) {
        return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    let body: RevenueCatWebhookBody;
    try {
        body = (await req.json()) as RevenueCatWebhookBody;
    } catch {
        return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const outcome = await applyWebhookEvent(body, env);
    if (!outcome.ok) {
        return Response.json({ ok: false, error: outcome.error }, { status: outcome.status });
    }
    return Response.json({
        ok: true,
        action: outcome.action,
        duplicate: outcome.duplicate === true,
        sandboxIgnored: outcome.sandboxIgnored === true,
    });
}
