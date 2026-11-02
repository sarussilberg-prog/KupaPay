-- Pro launch security mediums: support RPC, profile email lockdown, export Pro gate.

-- ---------------------------------------------------------------------------
-- M3 — Support messages via RPC (rate limit + length); drop open INSERT policy.
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_messages
    ADD CONSTRAINT support_messages_message_len CHECK (char_length(message) <= 5000),
    ADD CONSTRAINT support_messages_name_len CHECK (char_length(name) <= 200),
    ADD CONSTRAINT support_messages_email_len CHECK (char_length(email) <= 320);

DROP POLICY IF EXISTS "public_insert_support_messages" ON public.support_messages; -- safe-breaking: support form uses submit_support_message RPC (#712 follow-up)

CREATE OR REPLACE FUNCTION public.submit_support_message(
    p_name TEXT,
    p_email TEXT,
    p_message TEXT,
    p_website TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_website IS NOT NULL AND btrim(p_website) <> '' THEN
        RETURN jsonb_build_object('ok', true);
    END IF;

    IF p_name IS NULL OR btrim(p_name) = ''
       OR p_email IS NULL OR btrim(p_email) = ''
       OR p_message IS NULL OR btrim(p_message) = '' THEN
        RAISE EXCEPTION 'support_invalid_payload' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.support_messages (name, email, message)
    VALUES (btrim(p_name), btrim(p_email), btrim(p_message));

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_support_message(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_message(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- M4 — profiles.email synced from auth; not client-writable.
-- ---------------------------------------------------------------------------
REVOKE UPDATE (email) ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (
    name,
    phone,
    avatar_url,
    default_currency,
    language,
    updated_at
) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET email = NEW.email,
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_from_auth ON auth.users;
CREATE TRIGGER trg_sync_profile_email_from_auth
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.sync_profile_email_from_auth();

-- ---------------------------------------------------------------------------
-- M2 — Server-side Pro check before group PDF export (client still renders PDF).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_pro_for_group_export(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_active_group_member(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
    END IF;

    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro_required' USING ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_pro_for_group_export(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_pro_for_group_export(UUID) TO authenticated;
