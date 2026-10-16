import { createClient, type Session } from '@supabase/supabase-js';

export function supabaseProjectRef(supabaseUrl: string): string {
    const host = new URL(supabaseUrl).hostname;
    return host.split('.')[0] ?? host;
}

export function authStorageKey(supabaseUrl: string): string {
    return `sb-${supabaseProjectRef(supabaseUrl)}-auth-token`;
}

export async function signInDevTestUser(): Promise<{
    session: Session;
    storageKey: string;
    supabaseUrl: string;
}> {
    const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const email = process.env.E2E_TEST_EMAIL ?? 'e2e-playwright@kupay-dev.test';
    const password = process.env.E2E_TEST_PASSWORD;

    if (!supabaseUrl || !anonKey) {
        throw new Error('Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY (or EXPO_PUBLIC_* equivalents)');
    }
    if (!password) {
        throw new Error('Set E2E_TEST_PASSWORD');
    }

    const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
        throw new Error(`signInWithPassword failed: ${error?.message ?? 'no session'}`);
    }

    return {
        session: data.session,
        storageKey: authStorageKey(supabaseUrl),
        supabaseUrl,
    };
}
