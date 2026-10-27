#!/usr/bin/env node
/**
 * Idempotently ensure PostHog dashboard "KupaPay MAU (1000 epic)" exists (#422).
 * Requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (or FREE_TIER_* equivalents).
 * Read-only on events; creates dashboard metadata only when missing.
 */
const DASHBOARD_NAME = 'KupaPay MAU (1000 epic)';

function env(name, fallback) {
    const v = process.env[name]?.trim();
    return v || fallback?.trim() || '';
}

async function fetchJson(url, { method = 'GET', headers = {}, body } = {}) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = { raw: text };
    }
    if (!res.ok) {
        throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return json;
}

async function main() {
    const key =
        env('POSTHOG_PERSONAL_API_KEY') ||
        env('FREE_TIER_POSTHOG_PERSONAL_API_KEY');
    const projectId = env('POSTHOG_PROJECT_ID') || env('FREE_TIER_POSTHOG_PROJECT_ID');
    const host = (env('POSTHOG_HOST') || env('FREE_TIER_POSTHOG_HOST') || 'https://eu.i.posthog.com').replace(
        /\/$/,
        '',
    );

    if (!key || !projectId) {
        console.log(
            'PostHog dashboard ensure skipped: set POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (see cost-share-app/analytics/README.md).',
        );
        process.exit(0);
    }

    const auth = { Authorization: `Bearer ${key}` };
    const list = await fetchJson(`${host}/api/projects/${projectId}/dashboards/`, { headers: auth });
    const results = list?.results ?? list ?? [];
    const existing = results.find((d) => d.name === DASHBOARD_NAME);
    if (existing?.id) {
        console.log(`PostHog dashboard already exists: id=${existing.id} name=${DASHBOARD_NAME}`);
        console.log(`Set EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_ID=${existing.id} for admin deep link.`);
        return;
    }

    const created = await fetchJson(`${host}/api/projects/${projectId}/dashboards/`, {
        method: 'POST',
        headers: auth,
        body: { name: DASHBOARD_NAME, description: 'MAU / WAU / DAU + north star (#422). Add insights from posthog-dashboard-mau-tiles.json.' },
    });
    console.log(`Created PostHog dashboard id=${created.id}. Add tiles manually from cost-share-app/analytics/posthog-dashboard-mau-tiles.json.`);
    console.log(`Set EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_ID=${created.id}`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
