import * as Sentry from '@sentry/react-native';

function supabaseSpanName(input: RequestInfo | URL, init?: RequestInit): string {
    const method = (init?.method ?? 'GET').toUpperCase();
    const raw =
        typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
    try {
        const url = new URL(raw);
        const path = url.pathname.replace(/^\/rest\/v1\//, '').replace(/^\/auth\/v1\//, 'auth/');
        const short = path.split('?')[0] || url.pathname;
        return `supabase.${method} ${short}`;
    } catch {
        return `supabase.${method}`;
    }
}

/** Wrap fetch so each Supabase REST/Auth request becomes a Sentry span. */
export function createInstrumentedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        const name = supabaseSpanName(input, init);
        return Sentry.startSpan(
            {
                name,
                op: 'supabase.http',
            },
            () => baseFetch(input, init),
        );
    };
}
