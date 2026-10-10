import { assertEquals } from '@std/assert';
import {
    applyWebhookEvent,
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

Deno.test('applyWebhookEvent updates profile on subscription purchase', async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url.includes('/profiles?id=eq.user-1')) {
            return Promise.resolve(new Response(null, { status: 204 }));
        }
        return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;

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
        assertEquals(calls.some(c => c.startsWith('PATCH') && c.includes('profiles')), true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

Deno.test('applyWebhookEvent grants yearly credit on annual subscription', async () => {
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        urls.push(url);
        if (url.includes('/profiles?id=eq.user-1')) {
            return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url.includes('grant_included_trip_pass_credit')) {
            return Promise.resolve(new Response(null, { status: 204 }));
        }
        return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;

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
        assertEquals(urls.some(u => u.includes('grant_included_trip_pass_credit')), true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

Deno.test('applyWebhookEvent rejects trip pass without group_id attribute', async () => {
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
    assertEquals(outcome.ok, false);
    if (!outcome.ok) assertEquals(outcome.error, 'trip_pass_missing_group_id');
});
