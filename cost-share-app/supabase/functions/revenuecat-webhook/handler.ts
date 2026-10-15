/**
 * RevenueCat webhook → Supabase entitlement writes (idempotent via handle_revenuecat_webhook RPC).
 * @see docs/KUPAPAY_PRO_SETUP.md
 */

export interface WebhookEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    REVENUECAT_WEBHOOK_SECRET: string;
}

export const PRO_ENTITLEMENT_ID = 'pro';
export const PRODUCT_PRO_MONTHLY = 'kupapay_pro_monthly';
export const PRODUCT_PRO_YEARLY = 'kupapay_pro_yearly';
export const PRODUCT_TRIP_PASS = 'kupapay_trip_pass';

export interface RevenueCatEvent {
    type: string;
    id: string;
    app_user_id: string;
    product_id?: string;
    transaction_id?: string;
    entitlement_ids?: string[];
    expiration_at_ms?: number | null;
    purchased_at_ms?: number;
    subscriber_attributes?: Record<
        string,
        { value?: string; updated_at_ms?: number }
    >;
}

export interface RevenueCatWebhookBody {
    api_version?: string;
    event: RevenueCatEvent;
}

function msToIso(ms: number | null | undefined): string | null {
    if (ms == null || !Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
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

export function verifyAuthorization(req: Request, secret: string): boolean {
    if (!secret) return false;
    const auth = req.headers.get('authorization') ?? '';
    if (auth === secret) return true;
    if (auth === `Bearer ${secret}`) return true;
    return false;
}

export function proUntilFromEvent(event: RevenueCatEvent): string | null {
    if (event.entitlement_ids && !event.entitlement_ids.includes(PRO_ENTITLEMENT_ID)) {
        return null;
    }
    const product = event.product_id ?? '';
    if (product === PRODUCT_TRIP_PASS) return null;
    if (product !== PRODUCT_PRO_MONTHLY && product !== PRODUCT_PRO_YEARLY) {
        if (!event.entitlement_ids?.includes(PRO_ENTITLEMENT_ID)) return null;
    }
    return msToIso(event.expiration_at_ms ?? undefined);
}

export function isTripPassProduct(event: RevenueCatEvent): boolean {
    return event.product_id === PRODUCT_TRIP_PASS;
}

export function tripPassUntilFromEvent(event: RevenueCatEvent, now = new Date()): string {
    const exp = msToIso(event.expiration_at_ms ?? undefined);
    if (exp) return exp;
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString();
}

export type WebhookAction =
    | 'individual'
    | 'trip_pass'
    | 'trip_pass_unassigned'
    | 'yearly_credit'
    | 'ignored';

export type HandleOutcome =
    | { ok: true; action: WebhookAction; duplicate?: boolean }
    | { ok: false; status: number; error: string };

export async function applyWebhookEvent(
    body: RevenueCatWebhookBody,
    env: WebhookEnv,
): Promise<HandleOutcome> {
    const event = body.event;
    if (!event?.app_user_id || !event.id) {
        return { ok: false, status: 400, error: 'missing_event' };
    }

    const type = event.type ?? '';
    const grantTypes = new Set([
        'INITIAL_PURCHASE',
        'RENEWAL',
        'UNCANCELLATION',
        'NON_RENEWING_PURCHASE',
        'PRODUCT_CHANGE',
    ]);
    const revokeTypes = new Set(['EXPIRATION', 'CANCELLATION']);

    const isTripPass = isTripPassProduct(event) &&
        (grantTypes.has(type) || type === 'NON_RENEWING_PURCHASE');
    const proUntil = proUntilFromEvent(event);
    const isRevoke = revokeTypes.has(type) &&
        event.entitlement_ids?.includes(PRO_ENTITLEMENT_ID) === true;
    const isGrantSub = proUntil != null && grantTypes.has(type);
    const isYearly = event.product_id === PRODUCT_PRO_YEARLY && isGrantSub;

    if (!isTripPass && !isGrantSub && !isRevoke) {
        return { ok: true, action: 'ignored' };
    }

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
            p_user_id: event.app_user_id,
            p_event_type: type,
            p_product_id: event.product_id ?? null,
            p_pro_until: isRevoke || isGrantSub ? (proUntil ?? new Date(0).toISOString()) : null,
            p_trip_pass_until: isTripPass ? tripPassUntilFromEvent(event) : null,
            p_attr_group_id: parseUuid(readAttr(event, 'group_id')),
            p_is_trip_pass: isTripPass,
            p_is_yearly: isYearly,
            p_is_revoke: isRevoke,
        }),
    });

    if (!res.ok) {
        return { ok: false, status: 502, error: 'webhook_rpc_failed' };
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data.duplicate === true) {
        return { ok: true, action: 'ignored', duplicate: true };
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
    });
}
