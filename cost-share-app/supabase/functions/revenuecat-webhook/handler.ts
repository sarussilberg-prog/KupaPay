/**
 * RevenueCat webhook → Supabase entitlement writes (idempotent via handle_revenuecat_webhook RPC).
 * Store-agnostic: App Store and Google Play events share product ids (`kupapay_pro_*`, `kupapay_trip_pass`).
 * @see docs/KUPAPAY_PRO_SETUP.md
 */

export interface WebhookEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    REVENUECAT_WEBHOOK_SECRET: string;
    /** When not `true`, SANDBOX environment events are acknowledged but not applied. */
    REVENUECAT_ALLOW_SANDBOX_EVENTS?: string;
}

export const PRO_ENTITLEMENT_ID = 'pro';
export const PRODUCT_PRO_MONTHLY = 'kupapay_pro_monthly';
export const PRODUCT_PRO_YEARLY = 'kupapay_pro_yearly';
export const PRODUCT_TRIP_PASS = 'kupapay_trip_pass';

export interface RevenueCatEvent {
    type: string;
    id: string;
    app_user_id: string;
    /** SANDBOX | PRODUCTION — used to ignore sandbox in production webhook. */
    environment?: string;
    store?: string;
    product_id?: string;
    transaction_id?: string;
    entitlement_ids?: string[];
    expiration_at_ms?: number | null;
    purchased_at_ms?: number;
    event_timestamp_ms?: number;
    cancel_reason?: string;
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

export function allowSandboxEnvironment(
    environment: string | undefined,
    allowSandboxEvents: boolean,
): boolean {
    if (environment === 'SANDBOX' && !allowSandboxEvents) return false;
    return true;
}

export function hasProEntitlement(event: RevenueCatEvent): boolean {
    return event.entitlement_ids?.includes(PRO_ENTITLEMENT_ID) === true;
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

const GRANT_TYPES = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'NON_RENEWING_PURCHASE',
    'PRODUCT_CHANGE',
]);

const IMMEDIATE_CANCEL_REASONS = new Set(['CUSTOMER_SUPPORT', 'DEVELOPER_INITIATED']);

export function isImmediateProRevoke(event: RevenueCatEvent): boolean {
    const type = event.type ?? '';
    if (!hasProEntitlement(event) || isTripPassProduct(event)) return false;
    if (type === 'REFUND') return true;
    if (type === 'EXPIRATION') return true;
    if (type === 'CANCELLATION') {
        const reason = (event.cancel_reason ?? '').toUpperCase();
        return IMMEDIATE_CANCEL_REASONS.has(reason);
    }
    return false;
}

export function isTripPassRevoke(event: RevenueCatEvent): boolean {
    if (!isTripPassProduct(event)) return false;
    const type = event.type ?? '';
    if (type === 'REFUND' || type === 'EXPIRATION') return true;
    if (type === 'CANCELLATION') {
        const reason = (event.cancel_reason ?? '').toUpperCase();
        return IMMEDIATE_CANCEL_REASONS.has(reason);
    }
    return false;
}

export function isCancelAtPeriodEnd(event: RevenueCatEvent): boolean {
    const type = event.type ?? '';
    if (type !== 'CANCELLATION') return false;
    if (!hasProEntitlement(event) || isTripPassProduct(event)) return false;
    if (isImmediateProRevoke(event)) return false;
    return proUntilFromEvent(event) != null;
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

    const allowSandbox = env.REVENUECAT_ALLOW_SANDBOX_EVENTS === 'true';
    if (!allowSandboxEnvironment(event.environment, allowSandbox)) {
        return { ok: true, action: 'ignored', sandboxIgnored: true };
    }

    const userId = parseUuid(event.app_user_id);
    if (!userId) {
        return { ok: false, status: 400, error: 'invalid_app_user_id' };
    }

    const type = event.type ?? '';
    const isTripPassGrant = isTripPassProduct(event) &&
        (GRANT_TYPES.has(type) || type === 'NON_RENEWING_PURCHASE');
    const proUntil = proUntilFromEvent(event);
    const isGrantSub = proUntil != null && GRANT_TYPES.has(type);
    const isYearly = event.product_id === PRODUCT_PRO_YEARLY && isGrantSub;
    const tripPassRevoke = isTripPassRevoke(event);
    const immediateProRevoke = isImmediateProRevoke(event);
    const cancelAtEnd = isCancelAtPeriodEnd(event);

    if (
        !isTripPassGrant && !isGrantSub && !immediateProRevoke && !tripPassRevoke &&
        !cancelAtEnd
    ) {
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
            p_user_id: userId,
            p_event_type: type,
            p_product_id: event.product_id ?? null,
            p_pro_until: (isGrantSub || cancelAtEnd) ? proUntil : null,
            p_trip_pass_until: isTripPassGrant ? tripPassUntilFromEvent(event) : null,
            p_attr_group_id: parseUuid(readAttr(event, 'group_id')),
            p_is_trip_pass: isTripPassGrant,
            p_is_yearly: isYearly,
            p_is_immediate_pro_revoke: immediateProRevoke,
            p_is_trip_pass_revoke: tripPassRevoke,
            p_event_timestamp_ms: event.event_timestamp_ms ?? null,
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
