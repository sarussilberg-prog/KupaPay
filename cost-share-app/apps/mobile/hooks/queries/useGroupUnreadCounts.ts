import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { queryKeys } from './keys';

const UNREAD_STALE_MS = 30_000;

type GroupUnreadRow = { group_id: string; unread: number };

/** Map of groupId → unread activity count for the current user. */
export type GroupUnreadCounts = Record<string, number>;

async function fetchGroupUnreadCounts(): Promise<GroupUnreadCounts> {
    const { data, error } = await supabase.rpc('get_group_unread_counts');
    if (error) {
        console.error('Failed to fetch group unread counts:', error);
        return {};
    }
    const rows = (data ?? []) as GroupUnreadRow[];
    const out: GroupUnreadCounts = {};
    for (const row of rows) {
        out[row.group_id] = row.unread;
    }
    return out;
}

export function useGroupUnreadCounts() {
    const currentUserId = useAppStore(s => s.currentUser?.id);
    return useQuery({
        queryKey: queryKeys.groupUnreadCounts,
        queryFn: fetchGroupUnreadCounts,
        enabled: Boolean(currentUserId),
        staleTime: UNREAD_STALE_MS,
    });
}
