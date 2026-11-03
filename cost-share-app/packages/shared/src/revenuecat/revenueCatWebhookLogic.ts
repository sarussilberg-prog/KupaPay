/**
 * Pure RevenueCat webhook classification (edge handler + Jest).
 * @see cost-share-app/supabase/functions/revenuecat-webhook/handler.ts
 */

export const PRO_ENTITLEMENT_ID = 'pro';
export const PRODUCT_PRO_MONTHLY = 'kupapay_pro_monthly';
export const PRODUCT_PRO_YEARLY = 'kupapay_pro_yearly';
export const PRODUCT_TRIP_PASS = 'kupapay_trip_pass';

export interface RevenueCatWebhookEvent {
    type: string;
    id: string;
    app_user_id: string;
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

export const REVENUECAT_GRANT_EVENT_TYPES = [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'NON_RENEWING_PURCHASE',
    'PRODUCT_CHANGE',
] as const;

const GRANT_TYPES = new Set<string>(REVENUECAT_GRANT_EVENT_TYPES);

const IMMEDIATE_CANCEL_REASONS = new Set(['CUSTOMER_SUPPORT', 'DEVELOPER_INITIATED']);

function msToIso(ms: number | null | undefined): string | null {
    if (ms == null || !Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
}

function hasProEntitlement(event: RevenueCatWebhookEvent): boolean {
    return event.entitlement_ids?.includes(PRO_ENTITLEMENT_ID) === true;
}

export function proUntilFromEvent(event: RevenueCatWebhookEvent): string | null {
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

export function isTripPassProduct(event: RevenueCatWebhookEvent): boolean {
    return event.product_id === PRODUCT_TRIP_PASS;
}

export function tripPassUntilFromEvent(event: RevenueCatWebhookEvent, now = new Date()): string {
    const exp = msToIso(event.expiration_at_ms ?? undefined);
    if (exp) return exp;
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString();
}

/** Production webhook: ignore SANDBOX unless deployment allows all sandbox or this user is flagged. */
export function shouldApplySandboxRevenueCatEvent(
    environment: string | undefined,
    allowSandboxEvents: boolean,
    isRevenueCatTestUser: boolean,
): boolean {
    if (environment !== 'SANDBOX') return true;
    if (allowSandboxEvents) return true;
    return isRevenueCatTestUser;
}

export function isImmediateProRevoke(event: RevenueCatWebhookEvent): boolean {
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

function isTripPassRevoke(event: RevenueCatWebhookEvent): boolean {
    if (!isTripPassProduct(event)) return false;
    const type = event.type ?? '';
    if (type === 'REFUND' || type === 'EXPIRATION') return true;
    if (type === 'CANCELLATION') {
        const reason = (event.cancel_reason ?? '').toUpperCase();
        return IMMEDIATE_CANCEL_REASONS.has(reason);
    }
    return false;
}

export function isCancelAtPeriodEnd(event: RevenueCatWebhookEvent): boolean {
    const type = event.type ?? '';
    if (type !== 'CANCELLATION') return false;
    if (!hasProEntitlement(event) || isTripPassProduct(event)) return false;
    if (isImmediateProRevoke(event)) return false;
    return proUntilFromEvent(event) != null;
}

type RevenueCatWebhookRpcPlan =
    | { kind: 'ignore' }
    | {
          kind: 'rpc';
          p_pro_until: string | null;
          p_trip_pass_until: string | null;
          p_is_trip_pass: boolean;
          p_is_yearly: boolean;
          p_is_immediate_pro_revoke: boolean;
          p_is_trip_pass_revoke: boolean;
          p_event_timestamp_ms: number | null;
      };

export function planRevenueCatWebhookRpc(
    event: RevenueCatWebhookEvent,
    now = new Date(),
): RevenueCatWebhookRpcPlan {
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
        return { kind: 'ignore' };
    }

    return {
        kind: 'rpc',
        p_pro_until: (isGrantSub || cancelAtEnd) ? proUntil : null,
        p_trip_pass_until: isTripPassGrant ? tripPassUntilFromEvent(event, now) : null,
        p_is_trip_pass: isTripPassGrant,
        p_is_yearly: isYearly,
        p_is_immediate_pro_revoke: immediateProRevoke,
        p_is_trip_pass_revoke: tripPassRevoke,
        p_event_timestamp_ms: event.event_timestamp_ms ?? null,
    };
}
