import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ActivityRecord } from './handler.ts';

type ActivityRow = {
    id: string;
    user_id: string;
    kind: string;
    group_id: string | null;
    ref_id: string;
    actor_user_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

function stableJson(value: unknown): string {
    return JSON.stringify(value ?? null);
}

/** Compare webhook payload to the authoritative activity_events row. */
export function activityRecordMatchesRow(record: ActivityRecord, row: ActivityRow): boolean {
    if (record.id !== row.id) return false;
    if (record.user_id !== row.user_id) return false;
    if (record.kind !== row.kind) return false;
    if ((record.group_id ?? null) !== (row.group_id ?? null)) return false;
    if (record.ref_id !== row.ref_id) return false;
    if ((record.actor_user_id ?? null) !== (row.actor_user_id ?? null)) return false;
    if (record.created_at !== row.created_at) return false;
    if (stableJson(record.metadata) !== stableJson(row.metadata)) return false;
    return true;
}

export async function fetchVerifiedActivityRecord(
    sb: SupabaseClient,
    record: ActivityRecord,
): Promise<ActivityRecord | null> {
    const { data, error } = await sb
        .from('activity_events')
        .select('id, user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at')
        .eq('id', record.id)
        .maybeSingle();

    if (error || !data) return null;
    const row = data as ActivityRow;
    if (!activityRecordMatchesRow(record, row)) return null;

    return {
        id: row.id,
        user_id: row.user_id,
        kind: row.kind as ActivityRecord['kind'],
        group_id: row.group_id,
        ref_id: row.ref_id,
        actor_user_id: row.actor_user_id,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        created_at: row.created_at,
    };
}
