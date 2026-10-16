/**
 * Admin Sentry Service — typed wrappers over the admin-sentry-proxy Edge Function.
 *
 * The Edge Function re-verifies is_app_admin() per call, so failures can mean
 * (1) the caller is not actually admin, (2) the Sentry token is misconfigured,
 * or (3) Sentry is down. UI surfaces structured reasons via AdminSentryProxyError.
 */
import { supabase } from '../lib/supabase';

export type SentryEnvironment = 'dev' | 'prod';
export type SentryStatusFilter = 'unresolved' | 'all';
export type SentryTimeRange = '24h' | '7d' | '30d';
export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface SentryIssueSummary {
    id: string;
    shortId: string;
    title: string;
    level: SentryLevel | string;
    status: string;
    count: string;
    userCount: number;
    firstSeen: string;
    lastSeen: string;
    culprit: string | null;
    metadata: Record<string, unknown>;
}

export interface SentryIssueDetail extends SentryIssueSummary {
    project: { id: string | null; name: string | null; slug: string | null };
}

export interface SentryEventSummary {
    id: string;
    dateCreated: string;
    tags: Record<string, string>;
    user: { id: string | null; email: string | null; username: string | null } | null;
    exception: { type: string | null; value: string | null; topFrame: string | null } | null;
}

export interface ListIssuesParams {
    environment: SentryEnvironment;
    status?: SentryStatusFilter;
    timeRange?: SentryTimeRange;
    limit?: number;
}

interface ProxyResponse<T> {
    ok: boolean;
    data?: T;
    error?: string;
    status?: number;
    detail?: string;
    missing?: string[];
}

export class AdminSentryProxyError extends Error {
    readonly code: string;
    readonly httpStatus?: number;
    readonly detail?: string;
    readonly missing?: string[];

    constructor(payload: {
        code: string;
        httpStatus?: number;
        detail?: string;
        missing?: string[];
    }) {
        super(payload.code);
        this.name = 'AdminSentryProxyError';
        this.code = payload.code;
        this.httpStatus = payload.httpStatus;
        this.detail = payload.detail;
        this.missing = payload.missing;
    }
}

async function readProxyErrorBody(error: unknown): Promise<Partial<ProxyResponse<unknown>> | null> {
    const err = error as { context?: Response };
    const response = err?.context;
    if (!response || typeof response.json !== 'function') return null;
    try {
        const body = (await response.json()) as Partial<ProxyResponse<unknown>>;
        return body && typeof body === 'object' ? body : null;
    } catch {
        return null;
    }
}

function toProxyError(
    body: Partial<ProxyResponse<unknown>> | null,
    fallbackMessage: string,
    httpStatus?: number,
): AdminSentryProxyError {
    const code = body?.error ?? 'invoke_failed';
    return new AdminSentryProxyError({
        code,
        httpStatus: body?.status ?? httpStatus,
        detail: body?.detail ?? (code === 'invoke_failed' ? fallbackMessage : undefined),
        missing: body?.missing,
    });
}

async function invokeProxy<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke<ProxyResponse<T>>(
        'admin-sentry-proxy',
        { body },
    );
    if (error) {
        const parsed = await readProxyErrorBody(error);
        throw toProxyError(parsed, error.message);
    }
    if (!data || data.ok === false) {
        throw toProxyError(data ?? null, data?.error ?? 'admin_sentry_proxy_failed', data?.status);
    }
    return data.data as T;
}

export function fetchSentryIssues(params: ListIssuesParams): Promise<SentryIssueSummary[]> {
    return invokeProxy<SentryIssueSummary[]>({
        action: 'list_issues',
        environment: params.environment,
        status: params.status ?? 'unresolved',
        timeRange: params.timeRange ?? '24h',
        limit: params.limit ?? 25,
    });
}

export function fetchSentryIssueDetail(issueId: string): Promise<SentryIssueDetail> {
    return invokeProxy<SentryIssueDetail>({ action: 'issue_detail', issueId });
}

export function fetchSentryIssueEvents(issueId: string): Promise<SentryEventSummary[]> {
    return invokeProxy<SentryEventSummary[]>({ action: 'issue_events', issueId });
}
