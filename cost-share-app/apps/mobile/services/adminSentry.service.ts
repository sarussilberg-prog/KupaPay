/**
 * Admin Sentry Service — typed wrappers over the admin-sentry-proxy Edge Function.
 *
 * The Edge Function re-verifies is_app_admin() per call, so failures can mean
 * (1) the caller is not actually admin, (2) the Sentry token is misconfigured,
 * or (3) Sentry is down. UI surfaces these as a generic retry-able state.
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
}

async function invokeProxy<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke<ProxyResponse<T>>(
        'admin-sentry-proxy',
        { body },
    );
    if (error) throw error;
    if (!data || data.ok === false) {
        throw new Error(data?.error ?? 'admin_sentry_proxy_failed');
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
