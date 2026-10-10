/**
 * RevenueCat webhook → Supabase entitlement writes.
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
        // Unknown subscription product — still honor entitlement + expiration if present.
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

export type HandleOutcome =
    | { ok: true; action: 'individual' | 'trip_pass' | 'yearly_credit' | 'ignored' }
    | { ok: false; status: number; error: string };

export async function applyWebhookEvent(
    body: RevenueCatWebhookBody,
    env: WebhookEnv,
): Promise<HandleOutcome> {
    const event = body.event;
    if (!event?.app_user_id) {
        return { ok: false, status: 400, error: 'missing_event' };
    }

    const userId = event.app_user_id;
    const type = event.type ?? '';

    const grantTypes = new Set([
        'INITIAL_PURCHASE',
        'RENEWAL',
        'UNCANCELLATION',
        'NON_RENEWING_PURCHASE',
        'PRODUCT_CHANGE',
    ]);
    const revokeTypes = new Set(['EXPIRATION', 'CANCELLATION']);

    if (isTripPassProduct(event) && (grantTypes.has(type) || type === 'NON_RENEWING_PURCHASE')) {
        const groupId = readAttr(event, 'group_id');
        if (!groupId) {
            return { ok: false, status: 422, error: 'trip_pass_missing_group_id' };
        }
        const until = tripPassUntilFromEvent(event);
        const res = await upsertGroupPass(env, {
            groupId,
            purchasedBy: userId,
            until,
            storeProductId: event.product_id ?? PRODUCT_TRIP_PASS,
            revenuecatEventId: event.id,
            passSource: 'purchase',
        });
        if (!res.ok) return res;
        return { ok: true, action: 'trip_pass' };
    }

    const proUntil = proUntilFromEvent(event);
    if (proUntil && grantTypes.has(type)) {
        const res = await setProfileProUntil(env, userId, proUntil);
        if (!res.ok) return res;
        if (event.product_id === PRODUCT_PRO_YEARLY) {
            const credit = await grantIncludedTripPassCredit(env, userId);
            if (!credit.ok) return credit;
            return { ok: true, action: 'yearly_credit' };
        }
        return { ok: true, action: 'individual' };
    }

    if (revokeTypes.has(type) && event.entitlement_ids?.includes(PRO_ENTITLEMENT_ID)) {
        const exp = msToIso(event.expiration_at_ms ?? undefined) ?? new Date(0).toISOString();
        const res = await setProfileProUntil(env, userId, exp);
        if (!res.ok) return res;
        return { ok: true, action: 'individual' };
    }

    return { ok: true, action: 'ignored' };
}

async function setProfileProUntil(
    env: WebhookEnv,
    userId: string,
    proUntil: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ pro_until: proUntil }),
    });
    if (!res.ok) {
        return { ok: false, status: 502, error: 'profile_update_failed' };
    }
    return { ok: true };
}

async function grantIncludedTripPassCredit(
    env: WebhookEnv,
    userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/grant_included_trip_pass_credit`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_user_id: userId }),
    });
    if (!res.ok) {
        return { ok: false, status: 502, error: 'trip_pass_credit_failed' };
    }
    return { ok: true };
}

async function upsertGroupPass(
    env: WebhookEnv,
    row: {
        groupId: string;
        purchasedBy: string;
        until: string;
        storeProductId: string;
        revenuecatEventId: string;
        passSource: 'purchase' | 'included_yearly';
    },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/group_passes`;
    const res = await fetch(`${base}?on_conflict=group_id`, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
            group_id: row.groupId,
            purchased_by: row.purchasedBy,
            until: row.until,
            store_product_id: row.storeProductId,
            revenuecat_event_id: row.revenuecatEventId,
            pass_source: row.passSource,
        }),
    });
    if (!res.ok) {
        return { ok: false, status: 502, error: 'group_pass_upsert_failed' };
    }
    return { ok: true };
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
    return Response.json({ ok: true, action: outcome.action });
}
