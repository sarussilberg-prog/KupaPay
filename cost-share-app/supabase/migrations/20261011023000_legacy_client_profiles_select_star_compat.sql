-- Legacy store clients (≤1.2.x) query profiles with select('*'). Column-level GRANTs that
-- omit invite_token make PostgreSQL/PostgREST reject the query (42501). Expose a
-- security_invoker view with invite_token only on auth.uid(); keep writes/token lookups
-- on profiles_base for SECURITY DEFINER RPCs.

ALTER TABLE public.profiles RENAME TO profiles_base;

REVOKE ALL ON TABLE public.profiles_base FROM anon, authenticated;

CREATE OR REPLACE VIEW public.profiles
WITH (security_invoker = true)
AS
SELECT
    b.id,
    b.email,
    b.name,
    b.phone,
    b.avatar_url,
    b.default_currency,
    b.language,
    b.is_active,
    b.created_at,
    b.updated_at,
    b.deleted_at,
    b.activity_last_seen_at,
    b.pro_until,
    b.included_trip_pass_credits,
    CASE
        WHEN b.id = (SELECT auth.uid()) THEN b.invite_token
        ELSE NULL::text
    END AS invite_token
FROM public.profiles_base b;

GRANT SELECT ON public.profiles TO anon, authenticated;

GRANT UPDATE (
    name,
    email,
    phone,
    avatar_url,
    default_currency,
    language,
    updated_at
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.profiles_view_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles_base (
        id,
        name,
        email,
        avatar_url,
        phone,
        default_currency,
        language,
        is_active,
        invite_token,
        created_at,
        updated_at,
        deleted_at,
        activity_last_seen_at,
        pro_until,
        included_trip_pass_credits
    )
    VALUES (
        NEW.id,
        NEW.name,
        NEW.email,
        NEW.avatar_url,
        NEW.phone,
        COALESCE(NEW.default_currency, 'ILS'),
        COALESCE(NEW.language, 'en'),
        COALESCE(NEW.is_active, TRUE),
        NEW.invite_token,
        COALESCE(NEW.created_at, NOW()),
        COALESCE(NEW.updated_at, NOW()),
        NEW.deleted_at,
        NEW.activity_last_seen_at,
        NEW.pro_until,
        COALESCE(NEW.included_trip_pass_credits, 0)
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_view_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_base_invite TEXT;
BEGIN
    SELECT invite_token INTO v_base_invite
    FROM public.profiles_base
    WHERE id = OLD.id;

    UPDATE public.profiles_base
    SET
        name = NEW.name,
        email = NEW.email,
        phone = NEW.phone,
        avatar_url = NEW.avatar_url,
        default_currency = NEW.default_currency,
        language = NEW.language,
        is_active = NEW.is_active,
        updated_at = COALESCE(NEW.updated_at, NOW()),
        deleted_at = NEW.deleted_at,
        activity_last_seen_at = NEW.activity_last_seen_at,
        pro_until = NEW.pro_until,
        included_trip_pass_credits = NEW.included_trip_pass_credits,
        invite_token = COALESCE(NULLIF(NEW.invite_token, ''), v_base_invite)
    WHERE id = OLD.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_view_insert_tr ON public.profiles;
CREATE TRIGGER profiles_view_insert_tr
    INSTEAD OF INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_view_insert();

DROP TRIGGER IF EXISTS profiles_view_update_tr ON public.profiles;
CREATE TRIGGER profiles_view_update_tr
    INSTEAD OF UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_view_update();

-- Signup trigger must write the base table (view is not insertable from SD without rules).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles_base (id, name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_invite_token()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT invite_token FROM public.profiles_base WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mark_activity_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.profiles_base
    SET activity_last_seen_at = NOW()
    WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.rotate_friend_invite()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_new TEXT;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    v_new := generate_invite_token();
    UPDATE public.profiles_base SET invite_token = v_new WHERE id = v_me;
    RETURN v_new;
END;
$$;

-- Token lookup must use profiles_base (view masks invite_token on other rows).
CREATE OR REPLACE FUNCTION public.redeem_friend_invite(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_inviter_id UUID;
    v_inviter_name TEXT;
    v_a UUID;
    v_b UUID;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT id, name INTO v_inviter_id, v_inviter_name
    FROM public.profiles_base WHERE invite_token = p_token LIMIT 1;

    IF v_inviter_id IS NULL THEN
        RAISE EXCEPTION 'invite_not_found';
    END IF;
    IF v_inviter_id = v_me THEN
        RAISE EXCEPTION 'cannot_self_invite';
    END IF;

    IF v_me < v_inviter_id THEN
        v_a := v_me; v_b := v_inviter_id;
    ELSE
        v_a := v_inviter_id; v_b := v_me;
    END IF;

    INSERT INTO friendships (user_a_id, user_b_id, source)
    VALUES (v_a, v_b, 'request')
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

    DELETE FROM friend_blocks
    WHERE (user_id = v_me AND blocked_user_id = v_inviter_id)
       OR (user_id = v_inviter_id AND blocked_user_id = v_me);

    RETURN json_build_object(
        'friend_id', v_inviter_id,
        'friend_name', v_inviter_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_group RECORD;
    v_members JSON;
    v_count INT;
BEGIN
    SELECT id, name, avatar_url INTO v_profile
    FROM public.profiles_base WHERE invite_token = p_token LIMIT 1;

    IF FOUND THEN
        RETURN json_build_object(
            'kind', 'friend',
            'inviter', json_build_object(
                'id', v_profile.id,
                'name', v_profile.name,
                'avatar_url', v_profile.avatar_url
            )
        );
    END IF;

    SELECT g.id, g.name, g.default_currency
    INTO v_group
    FROM groups g
    WHERE g.invite_token = p_token AND g.is_active = true
    LIMIT 1;

    IF FOUND THEN
        SELECT COUNT(*) INTO v_count
        FROM group_members gm
        WHERE gm.group_id = v_group.id AND gm.is_active = true;

        SELECT json_agg(member_data ORDER BY member_data->>'name')
        INTO v_members
        FROM (
            SELECT json_build_object(
                'id', p.id,
                'name', p.name,
                'avatar_url', p.avatar_url
            ) AS member_data
            FROM group_members gm
            JOIN public.profiles p ON p.id = gm.user_id
            WHERE gm.group_id = v_group.id AND gm.is_active = true
            LIMIT 6
        ) m;

        RETURN json_build_object(
            'kind', 'group',
            'group', json_build_object(
                'id', v_group.id,
                'name', v_group.name,
                'currency', v_group.default_currency,
                'member_count', v_count,
                'members', COALESCE(v_members, '[]'::json)
            )
        );
    END IF;

    RETURN json_build_object('kind', 'invalid');
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_included_trip_pass_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles_base
    SET included_trip_pass_credits = 1
    WHERE id = p_user_id
      AND included_trip_pass_credits < 1;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_included_trip_pass(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_credits INT;
    v_pro_until TIMESTAMPTZ;
    v_until TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = v_uid
          AND gm.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
    END IF;

    SELECT pro_until, included_trip_pass_credits
    INTO v_pro_until, v_credits
    FROM public.profiles_base
    WHERE id = v_uid;

    IF v_pro_until IS NULL OR v_pro_until <= NOW() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'subscription_inactive');
    END IF;

    IF v_credits < 1 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_credit');
    END IF;

    v_until := NOW() + INTERVAL '30 days';

    INSERT INTO public.group_passes (
        group_id, purchased_by, until, store_product_id, pass_source
    )
    VALUES (
        p_group_id, v_uid, v_until, 'included_yearly', 'included_yearly'
    )
    ON CONFLICT (group_id) DO UPDATE SET
        purchased_by = EXCLUDED.purchased_by,
        until = GREATEST(public.group_passes.until, EXCLUDED.until),
        store_product_id = EXCLUDED.store_product_id,
        pass_source = EXCLUDED.pass_source,
        updated_at = NOW();

    UPDATE public.profiles_base
    SET included_trip_pass_credits = included_trip_pass_credits - 1
    WHERE id = v_uid AND included_trip_pass_credits > 0;

    RETURN jsonb_build_object('ok', true, 'groupPassUntil', v_until);
END;
$$;

-- delete_my_account and RevenueCat webhook write pro_until / scrub PII on base table.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email   TEXT;
    v_hash    TEXT;
    v_avatar  TEXT;
    v_balance JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'auth_user_missing';
    END IF;
    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    BEGIN
        v_balance := public.get_user_simplified_inputs(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_balance := jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    SELECT avatar_url INTO v_avatar FROM public.profiles_base WHERE id = v_user_id;

    INSERT INTO deleted_account_emails (email_hash)
        VALUES (v_hash)
        ON CONFLICT (email_hash) DO NOTHING;

    UPDATE public.profiles_base
        SET name = NULL,
            email = NULL,
            avatar_url = NULL,
            phone = NULL,
            is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id
          AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_already_inactive';
    END IF;

    UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz,
            email = v_user_id::text || '@deleted.kupapay.invalid',
            raw_user_meta_data = '{}'::jsonb,
            raw_app_meta_data = '{}'::jsonb
        WHERE id = v_user_id;

    DELETE FROM auth.refresh_tokens WHERE user_id = v_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;

    INSERT INTO account_deletions_audit (user_id, email_hash, reason, open_balance_snapshot)
        VALUES (v_user_id, v_hash, 'self_service', v_balance);

    IF v_avatar IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (object_path)
            VALUES (v_avatar)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_revenuecat_webhook(
    p_event_id TEXT,
    p_user_id UUID,
    p_event_type TEXT,
    p_product_id TEXT,
    p_pro_until TIMESTAMPTZ,
    p_trip_pass_until TIMESTAMPTZ,
    p_attr_group_id UUID,
    p_is_trip_pass BOOLEAN,
    p_is_yearly BOOLEAN,
    p_is_revoke BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted BOOLEAN := FALSE;
    v_group_id UUID;
    v_intent_group UUID;
    v_credit_granted BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.revenuecat_webhook_events (event_id, user_id, event_type)
    VALUES (p_event_id, p_user_id, p_event_type)
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('duplicate', true, 'action', 'ignored');
    END IF;

    IF p_is_revoke AND p_pro_until IS NOT NULL THEN
        UPDATE public.profiles_base SET pro_until = p_pro_until WHERE id = p_user_id;
        UPDATE public.revenuecat_webhook_events SET action = 'individual_revoke' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'individual');
    END IF;

    IF p_is_trip_pass AND p_trip_pass_until IS NOT NULL THEN
        SELECT t.group_id INTO v_intent_group
        FROM public.trip_pass_purchase_intents t
        WHERE t.user_id = p_user_id
          AND t.expires_at > NOW()
        ORDER BY t.created_at DESC
        LIMIT 1;

        v_group_id := v_intent_group;

        IF v_group_id IS NULL AND p_attr_group_id IS NOT NULL
           AND public.is_active_group_member(p_user_id, p_attr_group_id) THEN
            v_group_id := p_attr_group_id;
        END IF;

        IF v_group_id IS NOT NULL
           AND public.is_active_group_member(p_user_id, v_group_id) THEN
            INSERT INTO public.group_passes (
                group_id, purchased_by, until, store_product_id, revenuecat_event_id, pass_source
            )
            VALUES (
                v_group_id, p_user_id, p_trip_pass_until, 'kupapay_trip_pass', p_event_id, 'purchase'
            )
            ON CONFLICT (revenuecat_event_id) WHERE revenuecat_event_id IS NOT NULL DO NOTHING;

            DELETE FROM public.trip_pass_purchase_intents WHERE user_id = p_user_id;
            UPDATE public.revenuecat_webhook_events SET action = 'trip_pass' WHERE event_id = p_event_id;
            RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass', 'groupId', v_group_id);
        END IF;

        INSERT INTO public.unassigned_trip_passes (user_id, revenuecat_event_id, until)
        VALUES (p_user_id, p_event_id, p_trip_pass_until)
        ON CONFLICT (revenuecat_event_id) DO NOTHING;

        DELETE FROM public.trip_pass_purchase_intents WHERE user_id = p_user_id;
        UPDATE public.revenuecat_webhook_events SET action = 'trip_pass_unassigned' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass_unassigned');
    END IF;

    IF p_pro_until IS NOT NULL THEN
        UPDATE public.profiles_base SET pro_until = p_pro_until WHERE id = p_user_id;

        IF p_is_yearly THEN
            SELECT public.grant_included_trip_pass_credit(p_user_id) INTO v_credit_granted;
            UPDATE public.revenuecat_webhook_events
            SET action = CASE WHEN v_credit_granted THEN 'yearly_credit' ELSE 'individual' END
            WHERE event_id = p_event_id;
            RETURN jsonb_build_object(
                'duplicate', false,
                'action', CASE WHEN v_credit_granted THEN 'yearly_credit' ELSE 'individual' END
            );
        END IF;

        UPDATE public.revenuecat_webhook_events SET action = 'individual' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'individual');
    END IF;

    UPDATE public.revenuecat_webhook_events SET action = 'ignored' WHERE event_id = p_event_id;
    RETURN jsonb_build_object('duplicate', false, 'action', 'ignored');
END;
$$;
