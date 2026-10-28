import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client — shares localStorage session with the proxied Expo web app. */
export function getBrowserSupabaseClient(): SupabaseClient {
    if (browserClient) return browserClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC Supabase env for split calculator import');
    }

    browserClient = createClient(url, key, {
        auth: {
            storage: typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            flowType: 'pkce',
        },
    });

    return browserClient;
}
