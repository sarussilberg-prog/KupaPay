import { assertEquals } from '@std/assert';
import {
    applyWebhookEvent,
    handleRequest,
    proUntilFromEvent,
    tripPassUntilFromEvent,
    verifyAuthorization,
    type HandleOutcome,
    type RevenueCatEvent,
    type RevenueCatWebhookBody,
    type WebhookEnv,
    PRODUCT_PRO_MONTHLY,
    PRODUCT_TRIP_PASS,
} from './handler.ts';
import cancellationFixture from './fixtures/cancellation_pro.json' with { type: 'json' };
import expirationFixture from './fixtures/expiration_pro.json' with { type: 'json' };
import initialPurchaseFixture from './fixtures/initial_purchase_pro.json' with { type: 'json' };
import renewalFixture from './fixtures/renewal_pro.json' with { type: 'json' };
import trialFixture from './fixtures/trial_initial_purchase.json' with { type: 'json' };

const env: WebhookEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    REVENUECAT_WEBHOOK_SECRET: 'secret',
};

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';

const DEFAULT_PRO_MS = 1_800_000_000_000;

type MockFetchOptions = {
    revenueCatTestUser?: boolean;
    onTestUserLookup?: () => void;
    webhookHandler?: (
        body: Record<string, unknown>,
    ) => { status: number; json: Record<string, unknown> };
};

function mockSupabaseFetch(options: MockFetchOptions): () => void {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/rpc/is_revenuecat_test_user')) {
            options.onTestUserLookup?.();
            return Promise.resolve(
                new Response(JSON.stringify(options.revenueCatTestUser === true), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            );
        }
        if (url.includes('/rpc/handle_revenuecat_webhook') && options.webhookHandler) {
            const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
            const { status, json } = options.webhookHandler(parsed);
            return Promise.resolve(
                new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } }),
            );
        }
        return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;
    return () => {
        globalThis.fetch = originalFetch;
    };
}

type RpcTrack = { body?: Record<string, unknown>; called: boolean; testUserLookup: boolean };

async function withRpc<T>(
    rpcJson: Record<string, unknown>,
    run: (track: RpcTrack) => Promise<T>,
    options: Omit<MockFetchOptions, 'webhookHandler'> = {},
): Promise<T> {
    const track: RpcTrack = { called: false, testUserLookup: false };
    const restore = mockSupabaseFetch({
        revenueCatTestUser: options.revenueCatTestUser,
        onTestUserLookup: () => {
            track.testUserLookup = true;
        },
        webhookHandler: body => {
            track.called = true;
            track.body = body;
            return { status: 200, json: rpcJson };
        },
    });
    try {
        return await run(track);
    } finally {
        restore();
    }
}

function eventBody(
    event: Partial<RevenueCatEvent> & Pick<RevenueCatEvent, 'type' | 'id'>,
): RevenueCatWebhookBody {
    return {
        event: {
            app_user_id: TEST_USER_ID,
            product_id: PRODUCT_PRO_MONTHLY,
            entitlement_ids: ['pro'],
            ...event,
        },
    };
}

Deno.test('handleRequest returns 401 when authorization is invalid', async () => {
    const res = await handleRequest(
        new Request('https://example.com/webhook', {
            method: 'POST',
            headers: { authorization: 'not-the-secret', 'content-type': 'application/json' },
            body: JSON.stringify({ event: { type: 'TEST', id: '1', app_user_id: 'u' } }),
        }),
        env,
    );
    assertEquals(res.status, 401);
    const json = (await res.json()) as { error?: string };
    assertEquals(json.error, 'unauthorized');
});

Deno.test('verifyAuthorization accepts raw secret and Bearer', () => {
    assertEquals(
        verifyAuthorization(new Request('https://x', { headers: { authorization: 'secret' } }), 'secret'),
        true,
    );
    assertEquals(
        verifyAuthorization(
            new Request('https://x', { headers: { authorization: 'Bearer secret' } }),
            'secret',
        ),
        true,
    );
    assertEquals(verifyAuthorization(new Request('https://x'), 'secret'), false);
});

Deno.test('verifyAuthorization rejects wrong secret without throwing', () => {
    for (const [authorization, expected] of [
        ['Bearer wrong', false],
        ['secrex', false],
    ] as const) {
        assertEquals(
            verifyAuthorization(new Request('https://x', { headers: { authorization } }), 'secret'),
            expected,
        );
    }
});

Deno.test('proUntilFromEvent maps expiration ms', () => {
    const iso = proUntilFromEvent({
        type: 'RENEWAL',
        id: '1',
        app_user_id: TEST_USER_ID,
        product_id: PRODUCT_PRO_MONTHLY,
        entitlement_ids: ['pro'],
        expiration_at_ms: 1_700_000_000_000,
    });
    assertEquals(iso, new Date(1_700_000_000_000).toISOString());
});

Deno.test('tripPassUntilFromEvent defaults to 30 days', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const until = tripPassUntilFromEvent(
        { type: 'NON_RENEWING_PURCHASE', id: '1', app_user_id: 'u', product_id: PRODUCT_TRIP_PASS },
        now,
    );
    assertEquals(until, '2026-01-31T00:00:00.000Z');
});

type NoRpcCase = {
    name: string;
    body: RevenueCatWebhookBody;
    expected: HandleOutcome;
};

const NO_RPC_CASES: NoRpcCase[] = [
    {
        name: 'applyWebhookEvent ignores SANDBOX without RPC when sandbox disallowed',
        body: eventBody({
            type: 'INITIAL_PURCHASE',
            id: 'evt-sandbox',
            environment: 'SANDBOX',
            expiration_at_ms: DEFAULT_PRO_MS,
        }),
        expected: { ok: true, action: 'ignored', sandboxIgnored: true },
    },
    {
        name: 'cancellation without expiration does not call RPC',
        body: eventBody({
            type: 'CANCELLATION',
            id: 'evt-soft-cancel',
            expiration_at_ms: null,
            cancel_reason: 'UNSUBSCRIBE',
        }),
        expected: { ok: true, action: 'ignored' },
    },
];

for (const { name, body, expected } of NO_RPC_CASES) {
    Deno.test(name, async () => {
        await withRpc({}, async ({ called }) => {
            const outcome = await applyWebhookEvent(body, env);
            assertEquals(outcome, expected);
            assertEquals(called, false);
        });
    });
}

Deno.test('applyWebhookEvent stale RPC response is ignored', async () => {
    await withRpc({ duplicate: false, action: 'ignored', stale: true }, async track => {
        const outcome = await applyWebhookEvent(
            eventBody({
                type: 'RENEWAL',
                id: 'evt-stale',
                expiration_at_ms: DEFAULT_PRO_MS,
                event_timestamp_ms: 1_000,
            }),
            env,
        );
        assertEquals(outcome, { ok: true, action: 'ignored' });
        assertEquals(track.called, true);
    });
});

type RpcApplyCase = {
    name: string;
    body: RevenueCatWebhookBody;
    rpcJson: Record<string, unknown>;
    assert: (outcome: HandleOutcome, body: Record<string, unknown> | undefined) => void;
};

const RPC_APPLY_CASES: RpcApplyCase[] = [
    {
        name: 'applyWebhookEvent REFUND sends immediate pro revoke flags to RPC',
        body: eventBody({ type: 'REFUND', id: 'evt-refund-pro' }),
        rpcJson: { duplicate: false, action: 'individual' },
        assert(outcome, body) {
            assertEquals(outcome, { ok: true, action: 'individual' });
            assertEquals(body?.p_is_immediate_pro_revoke, true);
            assertEquals(body?.p_is_trip_pass_revoke, false);
            assertEquals(body?.p_pro_until, null);
        },
    },
    {
        name: 'applyWebhookEvent trip pass REFUND sends trip pass revoke to RPC',
        body: {
            event: {
                type: 'REFUND',
                id: 'evt-refund-trip',
                app_user_id: TEST_USER_ID,
                product_id: PRODUCT_TRIP_PASS,
            },
        },
        rpcJson: { duplicate: false, action: 'trip_pass' },
        assert(outcome, body) {
            assertEquals(outcome, { ok: true, action: 'trip_pass' });
            assertEquals(body?.p_is_trip_pass_revoke, true);
            assertEquals(body?.p_is_immediate_pro_revoke, false);
        },
    },
    {
        name: 'applyWebhookEvent calls RPC for subscription purchase',
        body: eventBody({
            type: 'INITIAL_PURCHASE',
            id: 'evt-1',
            expiration_at_ms: DEFAULT_PRO_MS,
        }),
        rpcJson: { duplicate: false, action: 'individual' },
        assert(outcome, body) {
            assertEquals(outcome, { ok: true, action: 'individual' });
            assertEquals(body?.p_event_id, 'evt-1');
            assertEquals(body?.p_is_trip_pass, false);
            assertEquals(body?.p_is_yearly, false);
            assertEquals(body?.p_is_immediate_pro_revoke, false);
            assertEquals(body?.p_is_trip_pass_revoke, false);
        },
    },
    {
        name: 'applyWebhookEvent calls RPC with yearly flag on annual subscription',
        body: eventBody({
            type: 'INITIAL_PURCHASE',
            id: 'evt-y',
            product_id: 'kupapay_pro_yearly',
            expiration_at_ms: 1_900_000_000_000,
        }),
        rpcJson: { duplicate: false, action: 'yearly_credit' },
        assert(outcome, body) {
            assertEquals(outcome, { ok: true, action: 'yearly_credit' });
            assertEquals(body?.p_is_yearly, true);
        },
    },
    {
        name: 'applyWebhookEvent trip pass with group_id sends p_attr_group_id to RPC',
        body: {
            event: {
                type: 'NON_RENEWING_PURCHASE',
                id: 'evt-g',
                app_user_id: TEST_USER_ID,
                product_id: PRODUCT_TRIP_PASS,
                subscriber_attributes: {
                    group_id: { value: '11111111-1111-4111-8111-111111111111' },
                },
            },
        },
        rpcJson: { duplicate: false, action: 'trip_pass' },
        assert(outcome, body) {
            assertEquals(outcome, { ok: true, action: 'trip_pass' });
            assertEquals(body?.p_attr_group_id, '11111111-1111-4111-8111-111111111111');
            assertEquals(body?.p_is_trip_pass, true);
        },
    },
    {
        name: 'applyWebhookEvent trip pass without group stores unassigned via RPC',
        body: {
            event: {
                type: 'NON_RENEWING_PURCHASE',
                id: 'evt-2',
                app_user_id: TEST_USER_ID,
                product_id: PRODUCT_TRIP_PASS,
            },
        },
        rpcJson: { duplicate: false, action: 'trip_pass_unassigned' },
        assert(outcome) {
            assertEquals(outcome, { ok: true, action: 'trip_pass_unassigned' });
        },
    },
    {
        name: 'applyWebhookEvent handles Google Play INITIAL_PURCHASE like App Store',
        body: eventBody({
            type: 'INITIAL_PURCHASE',
            id: 'evt-play-1',
            store: 'PLAY_STORE',
            expiration_at_ms: DEFAULT_PRO_MS,
        }),
        rpcJson: { duplicate: false, action: 'individual' },
        assert(outcome) {
            assertEquals(outcome, { ok: true, action: 'individual' });
        },
    },
    {
        name: 'applyWebhookEvent duplicate event is ignored',
        body: eventBody({
            type: 'INITIAL_PURCHASE',
            id: 'evt-dup',
            expiration_at_ms: DEFAULT_PRO_MS,
        }),
        rpcJson: { duplicate: true, action: 'ignored' },
        assert(outcome) {
            assertEquals(outcome, { ok: true, action: 'ignored', duplicate: true });
        },
    },
];

for (const { name, body, rpcJson, assert } of RPC_APPLY_CASES) {
    Deno.test(name, async () => {
        await withRpc(rpcJson, async track => {
            const outcome = await applyWebhookEvent(body, env);
            assert(outcome, track.body);
        });
    });
}

Deno.test('applyWebhookEvent rejects non-UUID app_user_id without RPC', async () => {
    const outcome = await applyWebhookEvent(
        eventBody({
            type: 'INITIAL_PURCHASE',
            id: 'evt-bad-user',
            app_user_id: 'not-a-uuid',
            expiration_at_ms: 1_700_000_000_000,
        }),
        env,
    );
    assertEquals(outcome, { ok: false, status: 400, error: 'invalid_app_user_id' });
});

const CONTRACT_FIXTURES: { name: string; body: RevenueCatWebhookBody }[] = [
    { name: 'initial_purchase_pro.json', body: initialPurchaseFixture as RevenueCatWebhookBody },
    { name: 'renewal_pro.json', body: renewalFixture as RevenueCatWebhookBody },
    { name: 'trial_initial_purchase.json', body: trialFixture as RevenueCatWebhookBody },
    { name: 'cancellation_pro.json', body: cancellationFixture as RevenueCatWebhookBody },
    { name: 'expiration_pro.json', body: expirationFixture as RevenueCatWebhookBody },
];

for (const fixture of CONTRACT_FIXTURES) {
    Deno.test(`contract fixture ${fixture.name} maps to RevenueCat RPC payload`, async () => {
        await withRpc({ duplicate: false, action: 'individual' }, async track => {
            const body = fixture.body;
            const outcome = await applyWebhookEvent(body, env);
            assertEquals(outcome.ok, true);
            if (body.event.type === 'CANCELLATION' && body.event.expiration_at_ms == null) {
                assertEquals(track.body, undefined);
                if (outcome.ok) assertEquals(outcome.action, 'ignored');
                return;
            }
            assertEquals(track.body?.p_event_id, body.event.id);
            assertEquals(track.body?.p_user_id, body.event.app_user_id);
            assertEquals(track.body?.p_event_type, body.event.type);
            if (body.event.type === 'EXPIRATION') {
                assertEquals(track.body?.p_is_immediate_pro_revoke, true);
            }
        });
    });
}

Deno.test('handleRequest accepts fixture body with shared secret', async () => {
    const body = initialPurchaseFixture as RevenueCatWebhookBody;
    await withRpc({ duplicate: false, action: 'individual' }, async () => {
        const res = await handleRequest(
            new Request('https://example.com/webhook', {
                method: 'POST',
                headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
                body: JSON.stringify(body),
            }),
            env,
        );
        assertEquals(res.status, 200);
        const json = (await res.json()) as { ok?: boolean; action?: string };
        assertEquals(json.ok, true);
        assertEquals(json.action, 'individual');
    });
});
