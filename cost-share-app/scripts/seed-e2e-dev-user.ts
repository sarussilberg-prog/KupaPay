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
const friendEmail = (process.env.E2E_FRIEND_EMAIL ?? 'e2e-friend@kupay-dev.test').trim().toLowerCase();
const password = process.env.E2E_TEST_PASSWORD?.trim();
const E2E_MAESTRO_GROUP_NAME = 'E2E Maestro Friends';

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
            default_currency: 'ILS',
            language: 'en',
            is_active: true,
        },
        { onConflict: 'id' },
    );
    if (profileErr) throw new Error(`profiles upsert: ${profileErr.message}`);

    const friendId = await ensureAuthUser(friendEmail, 'Salome Assaraf');
    await sb.from('profiles').upsert(
        {
            id: friendId,
            email: friendEmail,
            name: 'Salome Assaraf',
            default_currency: 'ILS',
            language: 'he',
            is_active: true,
        },
        { onConflict: 'id' },
    );

    await ensureMaestroFriendBalanceFixture(userId, friendId);

    console.log('E2E dev user ready:', email);
    console.log('E2E friend user ready:', friendEmail, friendId);
}

async function ensureAuthUser(userEmail: string, name: string): Promise<string> {
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === userEmail);
    if (existing?.id) {
        if (password) {
            await sb.auth.admin.updateUserById(existing.id, { password });
        }
        return existing.id;
    }
    if (!password) throw new Error('Missing E2E_TEST_PASSWORD');
    const { data, error } = await sb.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true,
        user_metadata: { name },
    });
    if (error || !data.user) throw new Error(`createUser ${userEmail}: ${error?.message}`);
    return data.user.id;
}

/** One shared group + single-currency ILS expense so Profile friend sheet is testable in Maestro. */
async function ensureMaestroFriendBalanceFixture(
    e2eUserId: string,
    friendUserId: string,
): Promise<void> {
    const { data: existingGroups } = await sb
        .from('groups')
        .select('id')
        .eq('name', E2E_MAESTRO_GROUP_NAME)
        .eq('created_by', e2eUserId)
        .limit(1);
    let groupId = existingGroups?.[0]?.id as string | undefined;

    if (!groupId) {
        const { data: group, error: groupErr } = await sb
            .from('groups')
            .insert({
                name: E2E_MAESTRO_GROUP_NAME,
                description: 'Device UI Maestro fixture',
                group_type: 'general',
                default_currency: 'ILS',
                created_by: e2eUserId,
            })
            .select('id')
            .single();
        if (groupErr || !group) throw new Error(`insert maestro group: ${groupErr?.message}`);
        groupId = group.id;
    }

    for (const memberId of [e2eUserId, friendUserId]) {
        const { error: memberErr } = await sb.from('group_members').upsert(
            { group_id: groupId, user_id: memberId, is_active: true },
            { onConflict: 'group_id,user_id' },
        );
        if (memberErr) throw new Error(`upsert group_member: ${memberErr.message}`);
    }

    const { data: existingExpense } = await sb
        .from('expenses')
        .select('id')
        .eq('group_id', groupId)
        .eq('description', 'E2E Maestro lunch')
        .limit(1);

    if (existingExpense?.length) return;

    const amount = 84;
    const { data: expense, error: expenseErr } = await sb
        .from('expenses')
        .insert({
            group_id: groupId,
            description: 'E2E Maestro lunch',
            amount,
            currency: 'ILS',
            category: 'food',
            expense_date: new Date().toISOString().slice(0, 10),
            paid_by: e2eUserId,
            created_by: e2eUserId,
        })
        .select('id')
        .single();
    if (expenseErr || !expense) throw new Error(`insert maestro expense: ${expenseErr?.message}`);

    const half = amount / 2;
    const { error: splitsErr } = await sb.from('expense_splits').insert([
        { expense_id: expense.id, user_id: e2eUserId, amount: half },
        { expense_id: expense.id, user_id: friendUserId, amount: half },
    ]);
    if (splitsErr) throw new Error(`insert maestro splits: ${splitsErr.message}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
