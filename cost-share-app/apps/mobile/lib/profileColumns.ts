/** PostgREST-selectable profile columns (column-level GRANT on public.profiles). */
export const PROFILE_SELECT_COLUMNS =
    'id, email, name, phone, avatar_url, default_currency, language, is_active, created_at, updated_at' as const;
