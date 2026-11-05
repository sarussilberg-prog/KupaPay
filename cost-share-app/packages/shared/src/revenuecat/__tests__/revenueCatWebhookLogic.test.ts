import {
    isCancelAtPeriodEnd,
    isImmediateProRevoke,
    planRevenueCatWebhookRpc,
    proUntilFromEvent,
    REVENUECAT_GRANT_EVENT_TYPES,
    shouldApplySandboxRevenueCatEvent,
    type RevenueCatWebhookEvent,
} from '../revenueCatWebhookLogic';

const USER = '00000000-0000-4000-8000-000000000001';
const EXP_MS = 1_900_000_000_000;

function proEvent(
    partial: Partial<RevenueCatWebhookEvent> & Pick<RevenueCatWebhookEvent, 'type' | 'id'>,
): RevenueCatWebhookEvent {
    return {
        app_user_id: USER,
        product_id: 'kupapay_pro_monthly',
        entitlement_ids: ['pro'],
        expiration_at_ms: EXP_MS,
        event_timestamp_ms: 5_000,
        environment: 'PRODUCTION',
        ...partial,
    };
}

describe('shouldApplySandboxRevenueCatEvent', () => {
    it('allows PRODUCTION regardless of flags', () => {
        expect(shouldApplySandboxRevenueCatEvent('PRODUCTION', false, false)).toBe(true);
    });

    it('blocks SANDBOX on production webhook unless test user', () => {
        expect(shouldApplySandboxRevenueCatEvent('SANDBOX', false, false)).toBe(false);
        expect(shouldApplySandboxRevenueCatEvent('SANDBOX', false, true)).toBe(true);
    });

    it('allows all SANDBOX when deployment flag is on', () => {
        expect(shouldApplySandboxRevenueCatEvent('SANDBOX', true, false)).toBe(true);
    });
});

describe('planRevenueCatWebhookRpc — grant event types', () => {
    it.each(REVENUECAT_GRANT_EVENT_TYPES)('%s grants pro subscription', type => {
        const plan = planRevenueCatWebhookRpc(proEvent({ type, id: `evt-${type}` }));
        expect(plan).toMatchObject({
            kind: 'rpc',
            p_is_immediate_pro_revoke: false,
            p_is_trip_pass_revoke: false,
            p_is_trip_pass: false,
        });
        if (plan.kind === 'rpc') {
            expect(plan.p_pro_until).toBe(new Date(EXP_MS).toISOString());
            expect(plan.p_event_timestamp_ms).toBe(5_000);
        }
    });
});

describe('planRevenueCatWebhookRpc — revoke and cancel semantics', () => {
    it('REFUND revokes pro immediately', () => {
        const plan = planRevenueCatWebhookRpc(proEvent({ type: 'REFUND', id: 'evt-refund' }));
        expect(plan).toEqual({
            kind: 'rpc',
            p_pro_until: null,
            p_trip_pass_until: null,
            p_is_trip_pass: false,
            p_is_yearly: false,
            p_is_immediate_pro_revoke: true,
            p_is_trip_pass_revoke: false,
            p_event_timestamp_ms: 5_000,
        });
    });

    it('EXPIRATION revokes pro immediately', () => {
        const plan = planRevenueCatWebhookRpc(proEvent({ type: 'EXPIRATION', id: 'evt-exp' }));
        expect(plan.kind).toBe('rpc');
        if (plan.kind === 'rpc') {
            expect(plan.p_is_immediate_pro_revoke).toBe(true);
            expect(plan.p_pro_until).toBe(new Date(EXP_MS).toISOString());
        }
    });

    it('CANCELLATION with expiration keeps access until period end', () => {
        expect(isCancelAtPeriodEnd(proEvent({ type: 'CANCELLATION', id: 'c1', cancel_reason: 'UNSUBSCRIBE' }))).toBe(
            true,
        );
        const plan = planRevenueCatWebhookRpc(
            proEvent({ type: 'CANCELLATION', id: 'c1', cancel_reason: 'UNSUBSCRIBE' }),
        );
        expect(plan.kind).toBe('rpc');
        if (plan.kind === 'rpc') {
            expect(plan.p_is_immediate_pro_revoke).toBe(false);
            expect(plan.p_pro_until).toBe(proUntilFromEvent(proEvent({ type: 'CANCELLATION', id: 'x' })));
        }
    });

    it('CANCELLATION without expiration is ignored at edge', () => {
        const plan = planRevenueCatWebhookRpc(
            proEvent({
                type: 'CANCELLATION',
                id: 'c-soft',
                expiration_at_ms: null,
                cancel_reason: 'UNSUBSCRIBE',
            }),
        );
        expect(plan).toEqual({ kind: 'ignore' });
    });

    it('CANCELLATION from support revokes immediately', () => {
        expect(
            isImmediateProRevoke(
                proEvent({ type: 'CANCELLATION', id: 'c2', cancel_reason: 'CUSTOMER_SUPPORT' }),
            ),
        ).toBe(true);
    });
});

describe('planRevenueCatWebhookRpc — ignored store events', () => {
    it.each(['BILLING_ISSUE', 'SUBSCRIPTION_PAUSED', 'TRANSFER', 'TEST'])(
        '%s does not call entitlement RPC',
        type => {
            expect(planRevenueCatWebhookRpc(proEvent({ type, id: `evt-${type}` }))).toEqual({ kind: 'ignore' });
        },
    );
});

describe('event_timestamp_ms for ordering', () => {
    it('forwards timestamp on grants and revokes for RPC stale checks', () => {
        const newer = planRevenueCatWebhookRpc(proEvent({ type: 'RENEWAL', id: 'r1', event_timestamp_ms: 9_000 }));
        const older = planRevenueCatWebhookRpc(proEvent({ type: 'REFUND', id: 'r2', event_timestamp_ms: 1_000 }));
        if (newer.kind === 'rpc' && older.kind === 'rpc') {
            expect(newer.p_event_timestamp_ms).toBe(9_000);
            expect(older.p_event_timestamp_ms).toBe(1_000);
        }
    });

    it('out-of-order: older renewal plan still carries lower timestamp (RPC rejects stale)', () => {
        const staleRenewal = planRevenueCatWebhookRpc(
            proEvent({ type: 'RENEWAL', id: 'stale', event_timestamp_ms: 2_000 }),
        );
        const refund = planRevenueCatWebhookRpc(proEvent({ type: 'REFUND', id: 'new', event_timestamp_ms: 8_000 }));
        if (staleRenewal.kind === 'rpc' && refund.kind === 'rpc') {
            expect(staleRenewal.p_event_timestamp_ms).toBeLessThan(refund.p_event_timestamp_ms ?? 0);
        }
    });
});

describe('sandbox vs production classification', () => {
    it('sandbox filtering is independent of RPC plan', () => {
        const event = proEvent({ type: 'INITIAL_PURCHASE', id: 'sb', environment: 'SANDBOX' });
        expect(shouldApplySandboxRevenueCatEvent(event.environment, false, false)).toBe(false);
        expect(planRevenueCatWebhookRpc(event).kind).toBe('rpc');
    });
});
