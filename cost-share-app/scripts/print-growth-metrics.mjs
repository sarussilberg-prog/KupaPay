#!/usr/bin/env node
/**
 * Prints north-star + active-user proxies from Postgres (#422).
 *
 * Usage (admin session):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... GROWTH_METRICS_ADMIN_JWT=... node scripts/print-growth-metrics.mjs
 *
 * Or run the SQL snapshot directly:
 *   psql "$DATABASE_URL" -f analytics/growth-metrics-snapshot.sql
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
const jwt = process.env.GROWTH_METRICS_ADMIN_JWT?.trim();

async function viaRpc() {
    if (!url || !anonKey || !jwt) {
        console.error(
            'Set SUPABASE_URL, SUPABASE_ANON_KEY, and GROWTH_METRICS_ADMIN_JWT (app admin user) to call get_growth_metrics().',
        );
        console.error('Alternatively: psql "$DATABASE_URL" -f analytics/growth-metrics-snapshot.sql');
        process.exit(1);
    }
    const client = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data, error } = await client.rpc('get_growth_metrics');
    if (error) {
        console.error('get_growth_metrics failed:', error.message);
        process.exit(1);
    }
    console.log(JSON.stringify(data, null, 2));
}

await viaRpc();
