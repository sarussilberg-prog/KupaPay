import { useQuery } from '@tanstack/react-query';
import {
    fetchSentryIssues,
    fetchSentryIssueDetail,
    fetchSentryIssueEvents,
    type ListIssuesParams,
} from '../../services/adminSentry.service';
import { queryKeys } from './keys';

const STALE_MS = 30_000;

export function useSentryIssuesQuery(params: ListIssuesParams) {
    return useQuery({
        queryKey: queryKeys.adminSentryIssues({
            environment: params.environment,
            status: params.status ?? 'unresolved',
            timeRange: params.timeRange ?? '24h',
        }),
        queryFn: () => fetchSentryIssues(params),
        staleTime: STALE_MS,
        retry: 1,
    });
}

export function useSentryIssueDetailQuery(issueId: string) {
    return useQuery({
        queryKey: queryKeys.adminSentryIssueDetail(issueId),
        queryFn: () => fetchSentryIssueDetail(issueId),
        staleTime: STALE_MS,
        retry: 1,
        enabled: !!issueId,
    });
}

export function useSentryIssueEventsQuery(issueId: string) {
    return useQuery({
        queryKey: queryKeys.adminSentryIssueEvents(issueId),
        queryFn: () => fetchSentryIssueEvents(issueId),
        staleTime: STALE_MS,
        retry: 1,
        enabled: !!issueId,
    });
}
