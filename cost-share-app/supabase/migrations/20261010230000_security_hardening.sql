-- Security hardening: admin support RPCs, profile invite_token column ACLs,
-- support message validation, stronger invite tokens, RLS initplan (auth.uid()).

-- ---------------------------------------------------------------------------
-- 1. Admin support RPCs lacked is_app_admin() (any authenticated user could
--    read/update all support_messages via PostgREST RPC).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_support_messages()
RETURNS TABLE (
    id          uuid,
    name        text,
    email       text,
    message     text,
    status      text,
    created_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT sm.id, sm.name, sm.email, sm.message, sm.status, sm.created_at
    FROM public.support_messages sm
    ORDER BY
        CASE WHEN sm.status = 'open' THEN 0 ELSE 1 END,
        sm.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_support_message_status(
    p_id     uuid,
    p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('open', 'closed') THEN
        RAISE EXCEPTION 'invalid_status';
    END IF;

    UPDATE public.support_messages
    SET status = p_status
    WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_support_messages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_support_messages() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_support_message_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_support_message_status(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Hide profiles.invite_token from PostgREST column projection (friend invite
--    links were enumerable via public SELECT on profiles). Own token via RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_invite_token()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT invite_token FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_invite_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_invite_token() TO authenticated;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (
    id,
    email,
    name,
    phone,
    avatar_url,
    default_currency,
    language,
    is_active,
    created_at,
    updated_at
) ON TABLE public.profiles TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Support message abuse: basic length bounds (public INSERT policy remains).
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_messages
    DROP CONSTRAINT IF EXISTS support_messages_name_len,
    DROP CONSTRAINT IF EXISTS support_messages_email_len,
    DROP CONSTRAINT IF EXISTS support_messages_message_len;

ALTER TABLE public.support_messages
    ADD CONSTRAINT support_messages_name_len
        CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    ADD CONSTRAINT support_messages_email_len
        CHECK (char_length(trim(email)) BETWEEN 3 AND 320),
    ADD CONSTRAINT support_messages_message_len
        CHECK (char_length(trim(message)) BETWEEN 1 AND 8000);

-- ---------------------------------------------------------------------------
-- 4. Stronger invite tokens for new rotations / backfill on NULL only (14 chars).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_token() RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
    v_alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    v_len      INT  := length(v_alphabet);
    v_token    TEXT := '';
    v_byte     INT;
    i          INT;
BEGIN
    FOR i IN 1..14 LOOP
        v_byte := get_byte(extensions.gen_random_bytes(1), 0);
        v_token := v_token || substr(v_alphabet, (v_byte % v_len) + 1, 1);
    END LOOP;
    RETURN v_token;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS initplan: wrap auth.uid() for hot policies (Postgres 14+).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING ((select auth.uid()) = id AND public.is_caller_active())
    WITH CHECK ((select auth.uid()) = id AND public.is_caller_active());

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups" ON public.groups
    FOR INSERT
    WITH CHECK ((select auth.uid()) = created_by AND public.is_caller_active());

DROP POLICY IF EXISTS "Users can insert group members" ON public.group_members;
CREATE POLICY "Users can insert group members" ON public.group_members
    FOR INSERT
    WITH CHECK (
        public.is_caller_active()
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.is_active = TRUE)
        AND (
            (select auth.uid()) = user_id
            OR public.is_group_creator(group_id)
            OR public.is_group_member(group_id)
        )
    );

DROP POLICY IF EXISTS "Either party can delete settlement" ON public.settlements;
CREATE POLICY "Either party can delete settlement" ON public.settlements
    FOR DELETE
    USING (
        public.is_caller_active()
        AND public.is_group_member(group_id)
        AND ((select auth.uid()) = from_user_id OR (select auth.uid()) = to_user_id)
    );

DROP POLICY IF EXISTS "users insert own monetization events" ON public.monetization_events;
CREATE POLICY "users insert own monetization events"
    ON public.monetization_events FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));
