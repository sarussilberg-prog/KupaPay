-- #395 — Guest (placeholder) group members: track expenses before friends sign up;
-- claim on join merges balances into the authenticated profile.

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS guest_claim_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_guest_claim_token_key
    ON public.profiles (guest_claim_token)
    WHERE guest_claim_token IS NOT NULL;

COMMENT ON COLUMN public.profiles.is_guest IS
    'Placeholder member without auth.users row; claim merges into a real profile.';
COMMENT ON COLUMN public.profiles.guest_claim_token IS
    'Optional token embedded in group invite metadata for claim UX (#395).';

CREATE OR REPLACE FUNCTION app_private.merge_guest_profile_into_user(
    p_guest_id UUID,
    p_real_id UUID,
    p_group_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row RECORD;
BEGIN
    IF p_guest_id = p_real_id THEN
        RETURN;
    END IF;

    PERFORM 1
    FROM public.profiles AS p
    WHERE p.id = p_guest_id
      AND p.is_guest = TRUE
      AND p.is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'guest_not_found';
    END IF;

    FOR v_row IN
        SELECT es.expense_id, es.amount
        FROM public.expense_splits AS es
        JOIN public.expenses AS e ON e.id = es.expense_id
        WHERE es.user_id = p_guest_id
          AND e.group_id = p_group_id
          AND e.is_deleted = FALSE
    LOOP
        UPDATE public.expense_splits AS es
        SET amount = es.amount + v_row.amount
        WHERE es.expense_id = v_row.expense_id
          AND es.user_id = p_real_id;

        IF FOUND THEN
            DELETE FROM public.expense_splits
            WHERE expense_id = v_row.expense_id
              AND user_id = p_guest_id;
        ELSE
            UPDATE public.expense_splits
            SET user_id = p_real_id
            WHERE expense_id = v_row.expense_id
              AND user_id = p_guest_id;
        END IF;
    END LOOP;

    UPDATE public.expenses AS e
    SET paid_by = p_real_id
    WHERE e.group_id = p_group_id
      AND e.paid_by = p_guest_id
      AND e.is_deleted = FALSE;

    UPDATE public.expenses AS e
    SET created_by = p_real_id
    WHERE e.group_id = p_group_id
      AND e.created_by = p_guest_id
      AND e.is_deleted = FALSE;

    UPDATE public.settlements AS s
    SET from_user_id = p_real_id
    WHERE s.group_id = p_group_id
      AND s.from_user_id = p_guest_id
      AND s.deleted_at IS NULL;

    UPDATE public.settlements AS s
    SET to_user_id = p_real_id
    WHERE s.group_id = p_group_id
      AND s.to_user_id = p_guest_id
      AND s.deleted_at IS NULL;

    UPDATE public.group_members
    SET is_active = FALSE, left_at = NOW()
    WHERE group_id = p_group_id
      AND user_id = p_guest_id;

    UPDATE public.profiles
    SET is_active = FALSE,
        is_guest = FALSE,
        guest_claim_token = NULL,
        name = LEFT(name, 90) || ' (merged)'
    WHERE id = p_guest_id;
END;
$$;

REVOKE ALL ON FUNCTION app_private.merge_guest_profile_into_user(UUID, UUID, UUID)
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_guest_group_member(
    p_group_id UUID,
    p_display_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_name TEXT := btrim(p_display_name);
    v_guest_id UUID := gen_random_uuid();
    v_currency TEXT;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF v_name IS NULL OR length(v_name) < 1 OR length(v_name) > 80 THEN
        RAISE EXCEPTION 'invalid_guest_name';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;

    SELECT g.default_currency INTO v_currency
    FROM public.groups AS g
    WHERE g.id = p_group_id
      AND g.is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'group_not_found';
    END IF;

    INSERT INTO public.profiles (
        id, name, is_guest, is_active, invite_token, guest_claim_token, default_currency, language
    )
    VALUES (
        v_guest_id,
        v_name,
        TRUE,
        TRUE,
        public.generate_invite_token(),
        public.generate_invite_token(),
        COALESCE(v_currency, 'ILS'),
        COALESCE((SELECT language FROM public.profiles WHERE id = v_me LIMIT 1), 'en')
    );

    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at)
    VALUES (p_group_id, v_guest_id, TRUE, NOW());

    RETURN json_build_object(
        'ok', TRUE,
        'guest_user_id', v_guest_id,
        'display_name', v_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.add_guest_group_member(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_guest_group_member(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_claimable_guest_members(p_group_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_guests JSON;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;

    SELECT COALESCE(json_agg(json_build_object(
        'user_id', p.id,
        'display_name', p.name
    ) ORDER BY p.name), '[]'::json)
    INTO v_guests
    FROM public.group_members AS gm
    JOIN public.profiles AS p ON p.id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND gm.is_active = TRUE
      AND p.is_guest = TRUE
      AND p.is_active = TRUE;

    RETURN json_build_object('guests', v_guests);
END;
$$;

REVOKE ALL ON FUNCTION public.list_claimable_guest_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_claimable_guest_members(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_guest_group_member(
    p_group_id UUID,
    p_guest_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;

    PERFORM 1
    FROM public.group_members AS gm
    JOIN public.profiles AS p ON p.id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_guest_user_id
      AND gm.is_active = TRUE
      AND p.is_guest = TRUE
      AND p.is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'guest_not_claimable';
    END IF;

    PERFORM app_private.merge_guest_profile_into_user(p_guest_user_id, v_me, p_group_id);

    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at)
    VALUES (p_group_id, v_me, TRUE, NOW())
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET is_active = TRUE, left_at = NULL, joined_at = NOW();

    RETURN json_build_object('ok', TRUE, 'claimed_user_id', p_guest_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_group_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_group_member(UUID, UUID) TO authenticated;

GRANT SELECT (is_guest) ON TABLE public.profiles TO authenticated;
