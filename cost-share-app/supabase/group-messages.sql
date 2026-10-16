-- Group chat messages: table, RLS, realtime publication, and RPCs used by the mobile app.
-- Idempotent: safe to re-run on dev (already patched) and production (missing).
-- Apply: supabase db query --linked -f supabase/group-messages.sql

-- ============================================================================
-- 1) Table + indexes + updated_at trigger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.group_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    edited_at    TIMESTAMPTZ,
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_messages_group_id_created_at_idx
    ON public.group_messages (group_id, created_at DESC);

DROP TRIGGER IF EXISTS update_group_messages_updated_at ON public.group_messages;
CREATE TRIGGER update_group_messages_updated_at
    BEFORE UPDATE ON public.group_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2) RLS
-- ============================================================================
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group messages" ON public.group_messages;
CREATE POLICY "Users can view group messages" ON public.group_messages
    FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Users can post group messages" ON public.group_messages;
CREATE POLICY "Users can post group messages" ON public.group_messages
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND public.is_group_member(group_id)
        AND public.is_caller_active()
    );

DROP POLICY IF EXISTS "Users can update own group messages" ON public.group_messages;
CREATE POLICY "Users can update own group messages" ON public.group_messages
    FOR UPDATE USING (
        user_id = auth.uid()
        AND public.is_group_member(group_id)
        AND public.is_caller_active()
    );

-- ============================================================================
-- 3) Realtime + last_activity trigger (group-archive.sql wires trigger when table exists)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'group_messages'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'bump_group_last_activity'
    ) THEN
        EXECUTE 'DROP TRIGGER IF EXISTS bump_group_last_activity_on_messages ON public.group_messages';
        EXECUTE 'CREATE TRIGGER bump_group_last_activity_on_messages
            AFTER INSERT ON public.group_messages
            FOR EACH ROW EXECUTE FUNCTION bump_group_last_activity()';
    END IF;
END $$;

-- ============================================================================
-- 4) RPCs (mobile: messages.service.ts)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_group_messages(
    p_group_id UUID,
    p_limit INT DEFAULT 100,
    p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.group_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INT;
BEGIN
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;

    v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);

    RETURN QUERY
    SELECT m.*
    FROM public.group_messages m
    WHERE m.group_id = p_group_id
      AND m.is_deleted = FALSE
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_message(
    p_group_id UUID,
    p_body TEXT
)
RETURNS public.group_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_body TEXT;
    v_row public.group_messages;
BEGIN
    v_body := btrim(p_body);
    IF char_length(v_body) < 1 OR char_length(v_body) > 2000 THEN
        RAISE EXCEPTION 'invalid_body' USING ERRCODE = '22023';
    END IF;
    IF NOT public.is_group_member(p_group_id) OR NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'not allowed';
    END IF;

    INSERT INTO public.group_messages (group_id, user_id, body)
    VALUES (p_group_id, auth.uid(), v_body)
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_group_message(
    p_message_id UUID,
    p_body TEXT
)
RETURNS public.group_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_body TEXT;
    v_row public.group_messages;
BEGIN
    v_body := btrim(p_body);
    IF char_length(v_body) < 1 OR char_length(v_body) > 2000 THEN
        RAISE EXCEPTION 'invalid_body' USING ERRCODE = '22023';
    END IF;

    UPDATE public.group_messages
    SET body = v_body,
        edited_at = NOW(),
        updated_at = NOW()
    WHERE id = p_message_id
      AND user_id = auth.uid()
      AND is_deleted = FALSE
      AND public.is_group_member(group_id)
      AND public.is_caller_active()
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'not found or not allowed';
    END IF;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_group_message(p_message_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    UPDATE public.group_messages
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_message_id
      AND user_id = auth.uid()
      AND is_deleted = FALSE
      AND public.is_group_member(group_id)
      AND public.is_caller_active()
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'not found or not allowed';
    END IF;

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_messages(UUID, INT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_group_message(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_group_message(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_group_message(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_group_messages(UUID, INT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_group_message(UUID) TO authenticated;
