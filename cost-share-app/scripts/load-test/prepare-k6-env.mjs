#!/usr/bin/env node
/**
 * Sign in with password and print K6_* / SUPABASE_* exports for k6 (dev only).
 * Requires: SUPABASE_URL, SUPABASE_ANON_KEY, LOAD_TEST_EMAIL, LOAD_TEST_PASSWORD
 * (falls back to E2E_TEST_* / EXPO_PUBLIC_*).
 */
import { createClient } from '@supabase/supabase-js';

function pickEnv(...keys) {
    for (const key of keys) {
        const v = process.env[key]?.trim();
        if (v) return v;
    }
    return '';
}

const supabaseUrl = pickEnv('SUPABASE_URL', 'LOAD_TEST_SUPABASE_URL', 'E2E_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const anonKey = pickEnv(
    'SUPABASE_ANON_KEY',
    'LOAD_TEST_SUPABASE_ANON_KEY',
    'E2E_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
);
const email = pickEnv('LOAD_TEST_EMAIL', 'E2E_TEST_EMAIL') || 'e2e-playwright@kupay-dev.test';
const password = pickEnv('LOAD_TEST_PASSWORD', 'E2E_TEST_PASSWORD');

if (!supabaseUrl.includes('drxfbicunusmipdgbgdk')) {
    console.error('Refusing non-dev Supabase URL for load test:', supabaseUrl);
    process.exit(1);
}
if (!supabaseUrl || !anonKey || !password) {
    console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or LOAD_TEST_PASSWORD / E2E_TEST_PASSWORD');
    process.exit(1);
}

const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error || !data.session?.access_token || !data.user?.id) {
    console.error('signInWithPassword failed:', error?.message ?? 'no session');
    process.exit(1);
}

const lines = [
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_ANON_KEY=${anonKey}`,
    `K6_USER_JWT=${data.session.access_token}`,
    `K6_USER_ID=${data.user.id}`,
];
console.log(lines.join('\n'));
