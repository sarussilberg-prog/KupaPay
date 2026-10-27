/**
 * PostgREST-selectable columns on public.profiles (column-level GRANT for authenticated).
 * Never use select('*') on profiles — wildcard fails when sensitive columns lack GRANT.
 */
export const PROFILE_SELECT_COLUMNS =
    'id, email, name, phone, avatar_url, default_currency, language, is_active, created_at, updated_at' as const;

/** Display-only fields for feeds and member lists. */
export const PROFILE_DISPLAY_COLUMNS = 'id, name, avatar_url, is_active, is_guest' as const;

/** Columns required by `groupMemberFromRow` — avoid select('*') on group_members. */
export const GROUP_MEMBER_SELECT_COLUMNS =
    'id, group_id, user_id, joined_at, left_at, is_active' as const;

/** Own-row activity watermark (RLS: id = auth.uid()). */
export const PROFILE_ACTIVITY_LAST_SEEN_COLUMN = 'activity_last_seen_at' as const;
