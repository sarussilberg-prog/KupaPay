#!/usr/bin/env node
/**
 * Idempotently create/update MAU dashboard insights and pin to KupaPay MAU dashboard (#584).
 * Requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (or FREE_TIER_* equivalents).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    MAU_DASHBOARD_NAME,
    MAU_INSIGHT_TAG,
    buildInsightQuery,
    dashboardIdsIncluding,
    expandTileSpecs,
    insightNameForSpec,
    queryFingerprint,
    readPostHogConfig,
} from './posthog-mau-tiles-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TILES_PATH = join(__dirname, '../analytics/posthog-dashboard-mau-tiles.json');

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
        throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return json;
}

async function listAllInsights(host, projectId, auth) {
    /** @type {Record<string, unknown>[]} */
    const all = [];
    let offset = 0;
    const limit = 100;
    for (;;) {
        const page = await fetchJson(
            `${host}/api/projects/${projectId}/insights/?limit=${limit}&offset=${offset}`,
            { headers: auth },
        );
        const results = page?.results ?? [];
        all.push(...results);
        if (!page?.next || results.length < limit) break;
        offset += limit;
    }
    return all;
}

async function findDashboard(host, projectId, auth) {
    const list = await fetchJson(`${host}/api/projects/${projectId}/dashboards/`, { headers: auth });
    const results = list?.results ?? list ?? [];
    return results.find((d) => d.name === MAU_DASHBOARD_NAME);
}

async function ensureDashboard(host, projectId, auth) {
    const existing = await findDashboard(host, projectId, auth);
    if (existing?.id) return existing.id;
    const created = await fetchJson(`${host}/api/projects/${projectId}/dashboards/`, {
        method: 'POST',
        headers: auth,
        body: {
            name: MAU_DASHBOARD_NAME,
            description: 'MAU / WAU / DAU + north star (#422). Tiles managed by posthog-ensure-mau-dashboard-tiles.mjs.',
        },
    });
    console.log(`Created dashboard id=${created.id}`);
    return created.id;
}

function loadTileSpecs() {
    const raw = JSON.parse(readFileSync(TILES_PATH, 'utf8'));
    return expandTileSpecs(raw.tiles ?? []);
}

function extractQuery(insight) {
    const q = insight?.query;
    if (!q) return null;
    if (q.kind === 'InsightVizNode' || q.kind === 'DataVisualizationNode') return q;
    if (q.source) return q;
    return { kind: 'InsightVizNode', source: q };
}

async function upsertInsight({
    host,
    projectId,
    auth,
    dashboardId,
    spec,
    existingByName,
}) {
    const name = insightNameForSpec(spec);
    const query = buildInsightQuery(spec.insight);
    const fingerprint = queryFingerprint(query);
    const existing = existingByName.get(name);
    const dashboards = dashboardIdsIncluding(existing?.dashboards ?? [], dashboardId);

    if (!existing) {
        const created = await fetchJson(`${host}/api/projects/${projectId}/insights/`, {
            method: 'POST',
            headers: auth,
            body: {
                name,
                description: `Managed by posthog-ensure-mau-dashboard-tiles.mjs (${spec.key})`,
                tags: [MAU_INSIGHT_TAG],
                dashboards,
                query,
            },
        });
        console.log(`Created insight id=${created.id} name=${name}`);
        return;
    }

    const existingQuery = extractQuery(existing);
    const existingFp = existingQuery ? queryFingerprint(existingQuery) : '';
    const patch = /** @type {Record<string, unknown>} */ ({ dashboards, tags: [MAU_INSIGHT_TAG] });
    if (existingFp !== fingerprint) {
        patch.query = query;
    }
    if (existingFp === fingerprint && (existing.dashboards ?? []).includes(dashboardId)) {
        console.log(`Unchanged insight id=${existing.id} name=${name}`);
        return;
    }
    await fetchJson(`${host}/api/projects/${projectId}/insights/${existing.id}/`, {
        method: 'PATCH',
        headers: auth,
        body: patch,
    });
    console.log(`${existingFp === fingerprint ? 'Linked' : 'Updated'} insight id=${existing.id} name=${name}`);
}

async function main() {
    const cfg = readPostHogConfig();
    if (!cfg) {
        console.log(
            'PostHog MAU tiles ensure skipped: set POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (see cost-share-app/analytics/README.md).',
        );
        process.exit(0);
    }

    const auth = { Authorization: `Bearer ${cfg.key}` };
    const dashboardId = await ensureDashboard(cfg.host, cfg.projectId, auth);
    const specs = loadTileSpecs();

    const insights = await listAllInsights(cfg.host, cfg.projectId, auth);
    const existingByName = new Map(
        insights.filter((i) => typeof i.name === 'string' && i.name.startsWith('KupaPay MAU · ')).map((i) => [i.name, i]),
    );

    for (const spec of specs) {
        await upsertInsight({
            host: cfg.host,
            projectId: cfg.projectId,
            auth,
            dashboardId,
            spec,
            existingByName,
        });
    }

    console.log(`Done. Dashboard id=${dashboardId}. Set EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_ID=${dashboardId} if needed.`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
