// admin-sentry-proxy handler.
// Re-verifies is_app_admin() on every call and proxies a fixed allowlist of
// Sentry REST endpoints. Exported as a pure function so it is testable without
// Deno.serve.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, preflight } from './cors.ts';

export interface ProxyEnv {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    /** Regional Sentry API host, e.g. https://de.sentry.io for EU orgs. */
    SENTRY_API_BASE_URL: string;
    SENTRY_API_TOKEN: string;
    SENTRY_ORG: string;
    SENTRY_PROJECT_DEV: string;
    SENTRY_PROJECT_PROD: string;
}

export const DEFAULT_SENTRY_ORG = 'kupay-hb';
export const DEFAULT_SENTRY_PROJECT_DEV = 'copay-mobile-dev';
export const DEFAULT_SENTRY_PROJECT_PROD = 'copay-mobile-prod';

/** EU org kupay-hb lives on de.sentry.io — sentry.io does not return EU project data. */
export function normalizeSentryApiBase(raw: string | undefined): string {
    const trimmed = raw?.trim();
    if (!trimmed) return 'https://de.sentry.io';
    return trimmed.replace(/\/$/, '');
}

export function buildSentryApiUrl(env: ProxyEnv, path: string): string {
    const base = normalizeSentryApiBase(env.SENTRY_API_BASE_URL);
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}/api/0${suffix}`;
}

export type FetchFn = typeof fetch;

interface IssueSummary {
    id: string;
    shortId: string;
    title: string;
    level: string;
    status: string;
    count: string;
    userCount: number;
    firstSeen: string;
    lastSeen: string;
    culprit: string | null;
    metadata: Record<string, unknown>;
}

interface SlimEvent {
    id: string;
    dateCreated: string;
    tags: Record<string, string>;
    user: { id: string | null; email: string | null; username: string | null } | null;
    exception: { type: string | null; value: string | null; topFrame: string | null } | null;
}

interface IssueDetail {
    id: string;
    shortId: string;
    title: string;
    culprit: string | null;
    level: string;
    status: string;
    count: string;
    userCount: number;
    firstSeen: string;
    lastSeen: string;
    metadata: Record<string, unknown>;
    project: { id: string | null; name: string | null; slug: string | null };
}

interface ActionListIssues {
    action: 'list_issues';
    environment: 'dev' | 'prod';
    status?: 'unresolved' | 'all';
    timeRange?: '24h' | '7d' | '30d';
    limit?: number;
}
interface ActionIssueEvents {
    action: 'issue_events';
    issueId: string;
}
interface ActionIssueDetail {
    action: 'issue_detail';
    issueId: string;
}
type ProxyAction = ActionListIssues | ActionIssueEvents | ActionIssueDetail;

type AdminVerdict =
    | { ok: true; isAdmin: boolean }
    | { ok: false; detail: string };

async function verifyCallerAdmin(client: SupabaseClient): Promise<AdminVerdict> {
    const { data, error } = await client.rpc('is_app_admin');
    if (error) return { ok: false, detail: error.message };
    return { ok: true, isAdmin: data === true };
}

function missingSentryCoreConfig(env: ProxyEnv): string[] {
    const missing: string[] = [];
    if (!env.SENTRY_ORG.trim()) missing.push('SENTRY_ORG');
    return missing;
}

type TokenResolveResult =
    | { ok: true; token: string }
    | { ok: false; response: Response };

function makeServiceClient(env: ProxyEnv): SupabaseClient {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/** Env var first; else Vault secret `sentry_api_token` via service_sentry_api_token RPC. */
export async function resolveSentryApiToken(env: ProxyEnv): Promise<TokenResolveResult> {
    const fromEnv = env.SENTRY_API_TOKEN.trim();
    if (fromEnv) return { ok: true, token: fromEnv };

    if (!env.SUPABASE_SERVICE_ROLE_KEY.trim()) {
        return {
            ok: false,
            response: jsonResponse({
                ok: false,
                error: 'sentry_not_configured',
                missing: ['SENTRY_API_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY'],
            }, 503),
        };
    }

    const serviceClient = makeServiceClient(env);
    const { data, error } = await serviceClient.rpc('service_sentry_api_token');
    if (error) {
        return {
            ok: false,
            response: jsonResponse({
                ok: false,
                error: 'sentry_token_lookup_failed',
                detail: error.message,
            }, 503),
        };
    }

    const fromVault = typeof data === 'string' ? data.trim() : '';
    if (!fromVault) {
        return {
            ok: false,
            response: jsonResponse({
                ok: false,
                error: 'sentry_not_configured',
                missing: ['SENTRY_API_TOKEN', 'vault:sentry_api_token'],
            }, 503),
        };
    }

    return { ok: true, token: fromVault };
}

function missingSentryConfig(env: ProxyEnv, environment: 'dev' | 'prod'): string[] {
    const missing = missingSentryCoreConfig(env);
    const project = environment === 'prod' ? env.SENTRY_PROJECT_PROD : env.SENTRY_PROJECT_DEV;
    if (!project.trim()) {
        missing.push(environment === 'prod' ? 'SENTRY_PROJECT_PROD' : 'SENTRY_PROJECT_DEV');
    }
    return missing;
}

function makeAuthedClient(env: ProxyEnv, jwt: string): SupabaseClient {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

type SentryCallResult =
    | { ok: true; data: unknown }
    | { ok: false; response: Response };

async function callSentry(
    url: string,
    apiToken: string,
    fetchFn: FetchFn,
): Promise<SentryCallResult> {
    let upstream: Response;
    try {
        upstream = await fetchFn(url, {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                Accept: 'application/json',
            },
        });
    } catch (err) {
        return {
            ok: false,
            response: jsonResponse({
                ok: false,
                status: 502,
                error: 'sentry_unreachable',
                detail: (err as Error).message,
            }, 502),
        };
    }

    if (upstream.status >= 500) {
        const text = await upstream.text().catch(() => '');
        return {
            ok: false,
            response: jsonResponse({
                ok: false,
                status: 502,
                error: 'sentry_server_error',
                upstreamStatus: upstream.status,
                detail: text.slice(0, 500),
            }, 502),
        };
    }

    if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        return {
            ok: false,
            response: jsonResponse({
                ok: false,
                status: upstream.status,
                error: 'sentry_client_error',
                detail: text.slice(0, 500),
            }, upstream.status),
        };
    }

    const data = await upstream.json();
    return { ok: true, data };
}

export async function handleRequest(
    req: Request,
    env: ProxyEnv,
    fetchFn: FetchFn = fetch,
): Promise<Response> {
    const pre = preflight(req);
    if (pre) return pre;

    if (req.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const auth = req.headers.get('authorization') ?? '';
    const jwt = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!jwt) {
        return jsonResponse({ ok: false, error: 'missing_authorization' }, 401);
    }

    const client = makeAuthedClient(env, jwt);
    const adminVerdict = await verifyCallerAdmin(client);
    if (!adminVerdict.ok) {
        return jsonResponse(
            { ok: false, error: 'admin_check_failed', detail: adminVerdict.detail },
            503,
        );
    }
    if (!adminVerdict.isAdmin) {
        return jsonResponse({ ok: false, error: 'forbidden' }, 403);
    }

    let body: ProxyAction;
    try {
        body = (await req.json()) as ProxyAction;
    } catch {
        return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }

    switch (body.action) {
        case 'list_issues':
            return await withSentryApiToken(env, (apiToken) =>
                proxyListIssues(body, env, apiToken, fetchFn)
            );
        case 'issue_events':
            return await withSentryApiToken(env, (apiToken) =>
                proxyIssueEvents(body, env, apiToken, fetchFn)
            );
        case 'issue_detail':
            return await withSentryApiToken(env, (apiToken) =>
                proxyIssueDetail(body, env, apiToken, fetchFn)
            );
        default:
            return jsonResponse({ ok: false, error: 'invalid_action' }, 400);
    }
}

async function withSentryApiToken(
    env: ProxyEnv,
    run: (apiToken: string) => Promise<Response>,
): Promise<Response> {
    const tokenResult = await resolveSentryApiToken(env);
    if (!tokenResult.ok) return tokenResult.response;
    return run(tokenResult.token);
}

// ---------- list_issues ----------

function projectSlug(env: ProxyEnv, environment: 'dev' | 'prod'): string {
    return environment === 'prod' ? env.SENTRY_PROJECT_PROD : env.SENTRY_PROJECT_DEV;
}

interface SentryListIssueRaw {
    id?: string;
    shortId?: string;
    title?: string;
    level?: string;
    status?: string;
    count?: string;
    userCount?: number;
    firstSeen?: string;
    lastSeen?: string;
    culprit?: string | null;
    metadata?: Record<string, unknown>;
}

function trimIssue(raw: SentryListIssueRaw): IssueSummary {
    return {
        id: raw.id ?? '',
        shortId: raw.shortId ?? '',
        title: raw.title ?? '',
        level: raw.level ?? 'error',
        status: raw.status ?? 'unresolved',
        count: raw.count ?? '0',
        userCount: raw.userCount ?? 0,
        firstSeen: raw.firstSeen ?? '',
        lastSeen: raw.lastSeen ?? '',
        culprit: raw.culprit ?? null,
        metadata: raw.metadata ?? {},
    };
}

async function proxyListIssues(
    body: ActionListIssues,
    env: ProxyEnv,
    apiToken: string,
    fetchFn: FetchFn,
): Promise<Response> {
    if (body.environment !== 'dev' && body.environment !== 'prod') {
        return jsonResponse({ ok: false, error: 'invalid_environment' }, 400);
    }
    const configGaps = missingSentryConfig(env, body.environment);
    if (configGaps.length > 0) {
        return jsonResponse(
            { ok: false, error: 'sentry_not_configured', missing: configGaps },
            503,
        );
    }
    const project = projectSlug(env, body.environment);
    const statusFilter = body.status === 'all' ? '' : 'is:unresolved';
    const range = body.timeRange ?? '24h';
    const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);
    const params = new URLSearchParams({
        environment: body.environment === 'prod' ? 'production' : 'development',
        statsPeriod: range,
        query: statusFilter,
        limit: String(limit),
        sort: 'date',
    });
    const url = `${buildSentryApiUrl(env, `/projects/${env.SENTRY_ORG}/${project}/issues/`)}?${params.toString()}`;

    const result = await callSentry(url, apiToken, fetchFn);
    if (!result.ok) return result.response;
    const data = result.data as SentryListIssueRaw[];
    const issues = Array.isArray(data) ? data.map(trimIssue) : [];
    return jsonResponse({ ok: true, data: issues }, 200);
}

// ---------- issue_events ----------

interface EventTagRaw { key?: string; value?: string }
interface SentryEventRaw {
    id?: string;
    eventID?: string;
    dateCreated?: string;
    tags?: EventTagRaw[];
    user?: { id?: string; email?: string; username?: string } | null;
    entries?: Array<{ type?: string; data?: unknown }>;
}

const KEEP_TAGS = new Set([
    'device.model',
    'device',
    'os.version',
    'os',
    'app.version',
    'release',
    'environment',
    'routing.route.name',
    'app_language',
    'default_currency',
]);

function trimTags(tags?: EventTagRaw[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const t of tags ?? []) {
        if (!t.key || t.value == null) continue;
        if (!KEEP_TAGS.has(t.key)) continue;
        out[t.key] = String(t.value);
    }
    return out;
}

function trimExceptionEntry(
    entries?: Array<{ type?: string; data?: unknown }>,
): SlimEvent['exception'] {
    const ex = entries?.find((e) => e.type === 'exception');
    if (!ex || typeof ex.data !== 'object' || ex.data == null) return null;
    const data = ex.data as {
        values?: Array<{
            type?: string;
            value?: string;
            stacktrace?: { frames?: Array<{ filename?: string; lineno?: number; function?: string }> };
        }>;
    };
    const first = data.values?.[0];
    if (!first) return null;
    const frames = first.stacktrace?.frames ?? [];
    const top = frames[frames.length - 1];
    const topFrame = top
        ? `${top.function ?? '<anon>'} (${top.filename ?? '?'}:${top.lineno ?? 0})`
        : null;
    return {
        type: first.type ?? null,
        value: first.value ?? null,
        topFrame,
    };
}

function trimEvent(raw: SentryEventRaw): SlimEvent {
    return {
        id: raw.id ?? raw.eventID ?? '',
        dateCreated: raw.dateCreated ?? '',
        tags: trimTags(raw.tags),
        user: raw.user
            ? {
                id: raw.user.id ?? null,
                email: raw.user.email ?? null,
                username: raw.user.username ?? null,
            }
            : null,
        exception: trimExceptionEntry(raw.entries),
    };
}

async function proxyIssueEvents(
    body: ActionIssueEvents,
    env: ProxyEnv,
    apiToken: string,
    fetchFn: FetchFn,
): Promise<Response> {
    if (!body.issueId || typeof body.issueId !== 'string') {
        return jsonResponse({ ok: false, error: 'invalid_issue_id' }, 400);
    }
    const configGaps = missingSentryCoreConfig(env);
    if (configGaps.length > 0) {
        return jsonResponse(
            { ok: false, error: 'sentry_not_configured', missing: configGaps },
            503,
        );
    }
    const url = `${buildSentryApiUrl(env, `/organizations/${env.SENTRY_ORG}/issues/${encodeURIComponent(body.issueId)}/events/`)}?limit=20`;
    const result = await callSentry(url, apiToken, fetchFn);
    if (!result.ok) return result.response;
    const data = result.data as SentryEventRaw[];
    const events = Array.isArray(data) ? data.map(trimEvent) : [];
    return jsonResponse({ ok: true, data: events }, 200);
}

// ---------- issue_detail ----------

interface SentryIssueDetailRaw {
    id?: string;
    shortId?: string;
    title?: string;
    culprit?: string | null;
    level?: string;
    status?: string;
    count?: string;
    userCount?: number;
    firstSeen?: string;
    lastSeen?: string;
    metadata?: Record<string, unknown>;
    project?: { id?: string; name?: string; slug?: string };
}

function trimDetail(raw: SentryIssueDetailRaw): IssueDetail {
    return {
        id: raw.id ?? '',
        shortId: raw.shortId ?? '',
        title: raw.title ?? '',
        culprit: raw.culprit ?? null,
        level: raw.level ?? 'error',
        status: raw.status ?? 'unresolved',
        count: raw.count ?? '0',
        userCount: raw.userCount ?? 0,
        firstSeen: raw.firstSeen ?? '',
        lastSeen: raw.lastSeen ?? '',
        metadata: raw.metadata ?? {},
        project: {
            id: raw.project?.id ?? null,
            name: raw.project?.name ?? null,
            slug: raw.project?.slug ?? null,
        },
    };
}

async function proxyIssueDetail(
    body: ActionIssueDetail,
    env: ProxyEnv,
    apiToken: string,
    fetchFn: FetchFn,
): Promise<Response> {
    if (!body.issueId || typeof body.issueId !== 'string') {
        return jsonResponse({ ok: false, error: 'invalid_issue_id' }, 400);
    }
    const configGaps = missingSentryCoreConfig(env);
    if (configGaps.length > 0) {
        return jsonResponse(
            { ok: false, error: 'sentry_not_configured', missing: configGaps },
            503,
        );
    }
    const url = buildSentryApiUrl(
        env,
        `/organizations/${env.SENTRY_ORG}/issues/${encodeURIComponent(body.issueId)}/`,
    );
    const result = await callSentry(url, apiToken, fetchFn);
    if (!result.ok) return result.response;
    const data = result.data as SentryIssueDetailRaw;
    return jsonResponse({ ok: true, data: trimDetail(data) }, 200);
}

export type { IssueSummary, SlimEvent, IssueDetail, ProxyAction };
