/**
 * Seed the database with sample data matching the original mock-data.ts.
 *
 * Run with:  npm run seed   (from apps/server)
 *
 * Behaviour:
 *  - Wipes existing data from all six tables (safe on a dev DB; do NOT run in prod).
 *  - Creates three Supabase Auth users -> trigger auto-creates profile rows.
 *  - Updates profile rows with extra fields (avatar, currency, language).
 *  - Inserts groups, group_members, expenses, expense_splits, settlements.
 *  - Logs the generated UUIDs at the end so you can use them in API calls.
 *
 * Requires SEED_DEV_PASSWORD in apps/server/.env (dev-only; never use in production).
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedDevPassword = process.env.SEED_DEV_PASSWORD;

if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in apps/server/.env');
    process.exit(1);
}

if (!seedDevPassword) {
    console.error('Missing SEED_DEV_PASSWORD. Set a dev-only password in apps/server/.env (see .env.example).');
    process.exit(1);
}

const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as never },
});

const sampleUsers = [
    { key: 'profile-1', email: 'john@example.com', name: 'John Doe', avatarUrl: 'https://i.pravatar.cc/150?img=1', phone: '+1234567890' },
    { key: 'profile-2', email: 'jane@example.com', name: 'Jane Smith', avatarUrl: 'https://i.pravatar.cc/150?img=2', phone: '+1234567891' },
    { key: 'profile-3', email: 'bob@example.com',  name: 'Bob Johnson', avatarUrl: 'https://i.pravatar.cc/150?img=3', phone: '+1234567892' },
];

async function wipe() {
    console.log('Wiping existing data...');
    // Order matters because of FK constraints.
    for (const table of ['settlements', 'expense_splits', 'expenses', 'group_members', 'groups']) {
        const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(`Wipe ${table}: ${error.message}`);
    }
    // Wipe auth users (which cascades to profiles).
    const { data: existing } = await sb.auth.admin.listUsers();
    for (const u of existing?.users ?? []) {
        if (sampleUsers.some(s => s.email === u.email)) {
            await sb.auth.admin.deleteUser(u.id);
        }
    }
}

async function createAuthUsersAndProfiles() {
    const idByKey = new Map<string, string>();

    for (const u of sampleUsers) {
        const { data, error } = await sb.auth.admin.createUser({
            email: u.email,
            password: seedDevPassword,
            email_confirm: true,
            user_metadata: { name: u.name, avatar_url: u.avatarUrl },
        });
        if (error || !data.user) throw new Error(`createUser ${u.email}: ${error?.message}`);
        idByKey.set(u.key, data.user.id);

        const { error: updErr } = await sb
            .from('profiles')
            .update({
                phone: u.phone,
                default_currency: 'USD',
                language: 'en',
            })
            .eq('id', data.user.id);
        if (updErr) throw new Error(`update profile ${u.email}: ${updErr.message}`);
    }

    return idByKey;
}

async function seedGroups(idByKey: Map<string, string>) {
    const groupKeys: { key: string; row: Record<string, any> }[] = [
        { key: 'group-1', row: { name: 'Weekend Trip',  description: 'Our amazing weekend getaway', image_url: 'https://picsum.photos/200/200?random=1', group_type: 'trip',    default_currency: 'USD', created_by: idByKey.get('profile-1') } },
        { key: 'group-2', row: { name: 'Roommates',     description: 'Apartment expenses',          image_url: 'https://picsum.photos/200/200?random=2', group_type: 'home',    default_currency: 'USD', created_by: idByKey.get('profile-1') } },
        { key: 'group-3', row: { name: 'Office Lunch',  description: 'Daily lunch expenses',        image_url: 'https://picsum.photos/200/200?random=3', group_type: 'general', default_currency: 'USD', created_by: idByKey.get('profile-2') } },
    ];

    const idByGroupKey = new Map<string, string>();
    for (const g of groupKeys) {
        const { data, error } = await sb.from('groups').insert(g.row).select('id').single();
        if (error) throw new Error(`insert group ${g.key}: ${error.message}`);
        idByGroupKey.set(g.key, data.id);
    }
    return idByGroupKey;
}

async function seedMembers(idByKey: Map<string, string>, idByGroupKey: Map<string, string>) {
    const rows = [
        // Weekend Trip: 3 members
        { group_id: idByGroupKey.get('group-1'), user_id: idByKey.get('profile-1') },
        { group_id: idByGroupKey.get('group-1'), user_id: idByKey.get('profile-2') },
        { group_id: idByGroupKey.get('group-1'), user_id: idByKey.get('profile-3') },
        // Roommates: 2 members
        { group_id: idByGroupKey.get('group-2'), user_id: idByKey.get('profile-1') },
        { group_id: idByGroupKey.get('group-2'), user_id: idByKey.get('profile-2') },
        // Office Lunch: 3 members
        { group_id: idByGroupKey.get('group-3'), user_id: idByKey.get('profile-1') },
        { group_id: idByGroupKey.get('group-3'), user_id: idByKey.get('profile-2') },
        { group_id: idByGroupKey.get('group-3'), user_id: idByKey.get('profile-3') },
    ];
    const { error } = await sb.from('group_members').insert(rows);
    if (error) throw new Error(`insert group_members: ${error.message}`);
}

async function seedExpensesAndSplits(idByKey: Map<string, string>, idByGroupKey: Map<string, string>) {
    const expenses = [
        { key: 'expense-1', group: 'group-1', description: 'Hotel booking',       amount: 300, category: 'accommodation', paid_by: 'profile-1', expense_date: '2024-01-20',
          splits: [['profile-1', 100], ['profile-2', 100], ['profile-3', 100]] },
        { key: 'expense-2', group: 'group-1', description: 'Dinner at restaurant', amount: 120, category: 'food',          paid_by: 'profile-2', expense_date: '2024-01-21',
          splits: [['profile-1', 40], ['profile-2', 40], ['profile-3', 40]] },
        { key: 'expense-3', group: 'group-2', description: 'Electricity bill',    amount: 80,  category: 'utilities',     paid_by: 'profile-1', expense_date: '2024-01-15',
          splits: [['profile-1', 40], ['profile-2', 40]] },
        { key: 'expense-4', group: 'group-3', description: 'Pizza lunch',         amount: 45,  category: 'food',          paid_by: 'profile-3', expense_date: '2024-01-22',
          splits: [['profile-1', 15], ['profile-2', 15], ['profile-3', 15]] },
    ];

    for (const e of expenses) {
        const { data, error } = await sb.from('expenses').insert({
            group_id: idByGroupKey.get(e.group),
            description: e.description,
            amount: e.amount,
            currency: 'USD',
            category: e.category,
            expense_date: e.expense_date,
            paid_by: idByKey.get(e.paid_by),
            created_by: idByKey.get(e.paid_by),
        }).select('id').single();
        if (error) throw new Error(`insert expense ${e.key}: ${error.message}`);

        const splitRows = e.splits.map(([userKey, amount]) => ({
            expense_id: data.id,
            user_id: idByKey.get(userKey as string),
            amount,
        }));
        const { error: splitsErr } = await sb.from('expense_splits').insert(splitRows);
        if (splitsErr) throw new Error(`insert splits for ${e.key}: ${splitsErr.message}`);
    }
}

async function seedSettlements(idByKey: Map<string, string>, idByGroupKey: Map<string, string>) {
    const rows = [
        { group_id: idByGroupKey.get('group-1'), from_user_id: idByKey.get('profile-2'), to_user_id: idByKey.get('profile-1'),
          amount: 50, currency: 'USD', settlement_date: '2024-01-25', payment_method: 'bank_transfer', created_by: idByKey.get('profile-2') },
        { group_id: idByGroupKey.get('group-2'), from_user_id: idByKey.get('profile-2'), to_user_id: idByKey.get('profile-1'),
          amount: 30, currency: 'USD', settlement_date: '2024-01-26', payment_method: 'cash',           created_by: idByKey.get('profile-2') },
    ];
    const { error } = await sb.from('settlements').insert(rows);
    if (error) throw new Error(`insert settlements: ${error.message}`);
}

async function main() {
    await wipe();
    const idByKey = await createAuthUsersAndProfiles();
    const idByGroupKey = await seedGroups(idByKey);
    await seedMembers(idByKey, idByGroupKey);
    await seedExpensesAndSplits(idByKey, idByGroupKey);
    await seedSettlements(idByKey, idByGroupKey);

    console.log('\nSeed complete. IDs you can use in API calls:');
    console.log('Profiles:');
    for (const [key, id] of idByKey) console.log(`  ${key}: ${id}`);
    console.log('Groups:');
    for (const [key, id] of idByGroupKey) console.log(`  ${key}: ${id}`);
}

main().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
