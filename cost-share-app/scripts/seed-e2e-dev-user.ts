/**
 * Idempotent dev Supabase user for Playwright (development project only).
 *
 * Env (supabase/.env or CI secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   E2E_TEST_EMAIL (default e2e-playwright@kupay-dev.test)
 *   E2E_TEST_PASSWORD (required)
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = (process.env.E2E_TEST_EMAIL ?? 'e2e-playwright@kupay-dev.test').trim().toLowerCase();
const password = process.env.E2E_TEST_PASSWORD?.trim();

if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!password) {
    console.error('Missing E2E_TEST_PASSWORD');
    process.exit(1);
}

const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId = existing?.id;
    if (!userId) {
        const { data, error } = await sb.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: 'E2E Playwright' },
        });
        if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
        userId = data.user.id;
        console.log('Created auth user', email, userId);
    } else {
        const { error } = await sb.auth.admin.updateUserById(userId, { password });
        if (error) throw new Error(`updateUser password: ${error.message}`);
        console.log('Updated password for existing user', email, userId);
    }

    const { error: profileErr } = await sb.from('profiles').upsert(
        {
            id: userId,
            email,
            name: 'E2E Playwright',
            default_currency: 'USD',
            language: 'en',
            is_active: true,
        },
        { onConflict: 'id' },
    );
    if (profileErr) throw new Error(`profiles upsert: ${profileErr.message}`);

    console.log('E2E dev user ready:', email);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
