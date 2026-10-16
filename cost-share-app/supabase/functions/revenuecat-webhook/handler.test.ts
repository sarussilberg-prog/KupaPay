import { assertEquals } from '@std/assert';
import {
    applyWebhookEvent,
    handleRequest,
    proUntilFromEvent,
    tripPassUntilFromEvent,
    verifyAuthorization,
    type WebhookEnv,
    PRODUCT_PRO_MONTHLY,
    PRODUCT_TRIP_PASS,
} from './handler.ts';

const env: WebhookEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    REVENUECAT_WEBHOOK_SECRET: 'secret',
};

function mockRpcFetch(
    handler: (body: Record<string, unknown>) => { status: number; json: Record<string, unknown> },
): () => void {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/rpc/handle_revenuecat_webhook')) {
            const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
            const { status, json } = handler(parsed);
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
    assertEquals(
        verifyAuthorization(new Request('https://x', { headers: { authorization: 'Bearer wrong' } }), 'secret'),
        false,
    );
    assertEquals(
        verifyAuthorization(new Request('https://x', { headers: { authorization: 'secrex' } }), 'secret'),
        false,
    );
});

Deno.test('proUntilFromEvent maps expiration ms', () => {
    const iso = proUntilFromEvent({
        type: 'RENEWAL',
        id: '1',
        app_user_id: 'u',
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

Deno.test('applyWebhookEvent calls RPC for subscription purchase', async () => {
    const captured: { body?: Record<string, unknown> } = {};
    const restore = mockRpcFetch(body => {
        captured.body = body;
        return { status: 200, json: { duplicate: false, action: 'individual' } };
    });
    try {
        const outcome = await applyWebhookEvent(
            {
                event: {
                    type: 'INITIAL_PURCHASE',
                    id: 'evt-1',
                    app_user_id: 'user-1',
                    product_id: PRODUCT_PRO_MONTHLY,
                    entitlement_ids: ['pro'],
                    expiration_at_ms: 1_800_000_000_000,
                },
            },
            env,
        );
        assertEquals(outcome, { ok: true, action: 'individual' });
        assertEquals(captured.body?.p_event_id, 'evt-1');
        assertEquals(captured.body?.p_is_trip_pass, false);
        assertEquals(captured.body?.p_is_yearly, false);
    } finally {
        restore();
    }
});

Deno.test('applyWebhookEvent calls RPC with yearly flag on annual subscription', async () => {
    const captured: { body?: Record<string, unknown> } = {};
    const restore = mockRpcFetch(body => {
        captured.body = body;
        return { status: 200, json: { duplicate: false, action: 'yearly_credit' } };
    });
    try {
        const outcome = await applyWebhookEvent(
            {
                event: {
                    type: 'INITIAL_PURCHASE',
                    id: 'evt-y',
                    app_user_id: 'user-1',
                    product_id: 'kupapay_pro_yearly',
                    entitlement_ids: ['pro'],
                    expiration_at_ms: 1_900_000_000_000,
                },
            },
            env,
        );
        assertEquals(outcome, { ok: true, action: 'yearly_credit' });
        assertEquals(captured.body?.p_is_yearly, true);
    } finally {
        restore();
    }
});

Deno.test('applyWebhookEvent trip pass with group_id sends p_attr_group_id to RPC', async () => {
    const groupId = '11111111-1111-4111-8111-111111111111';
    const captured: { body?: Record<string, unknown> } = {};
    const restore = mockRpcFetch(body => {
        captured.body = body;
        return { status: 200, json: { duplicate: false, action: 'trip_pass' } };
    });
    try {
        const outcome = await applyWebhookEvent(
            {
                event: {
                    type: 'NON_RENEWING_PURCHASE',
                    id: 'evt-g',
                    app_user_id: 'user-1',
                    product_id: PRODUCT_TRIP_PASS,
                    subscriber_attributes: {
                        group_id: { value: groupId },
                    },
                },
            },
            env,
        );
        assertEquals(outcome, { ok: true, action: 'trip_pass' });
        assertEquals(captured.body?.p_attr_group_id, groupId);
        assertEquals(captured.body?.p_is_trip_pass, true);
    } finally {
        restore();
    }
});

Deno.test('applyWebhookEvent trip pass without group stores unassigned via RPC', async () => {
    const restore = mockRpcFetch(() => ({
        status: 200,
        json: { duplicate: false, action: 'trip_pass_unassigned' },
    }));
    try {
        const outcome = await applyWebhookEvent(
            {
                event: {
                    type: 'NON_RENEWING_PURCHASE',
                    id: 'evt-2',
                    app_user_id: 'user-1',
                    product_id: PRODUCT_TRIP_PASS,
                },
            },
            env,
        );
        assertEquals(outcome, { ok: true, action: 'trip_pass_unassigned' });
    } finally {
        restore();
    }
});

Deno.test('applyWebhookEvent duplicate event is ignored', async () => {
    const restore = mockRpcFetch(() => ({
        status: 200,
        json: { duplicate: true, action: 'ignored' },
    }));
    try {
        const outcome = await applyWebhookEvent(
            {
                event: {
                    type: 'INITIAL_PURCHASE',
                    id: 'evt-dup',
                    app_user_id: 'user-1',
                    product_id: PRODUCT_PRO_MONTHLY,
                    entitlement_ids: ['pro'],
                    expiration_at_ms: 1_800_000_000_000,
                },
            },
            env,
        );
        assertEquals(outcome, { ok: true, action: 'ignored', duplicate: true });
    } finally {
        restore();
    }
});
