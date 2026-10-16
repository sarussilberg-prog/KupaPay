-- #208 — Rate-limit anonymous invite preview probing (per client IP, 1h window).

CREATE TABLE IF NOT EXISTS public.invite_preview_rate_limits (
    client_key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (client_key, window_start)
);

ALTER TABLE public.invite_preview_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.invite_preview_client_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_headers JSONB;
    v_ip TEXT;
BEGIN
    BEGIN
        v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    v_ip := COALESCE(
        v_headers->>'cf-connecting-ip',
        split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1),
        v_headers->>'x-real-ip',
        'unknown'
    );
    RETURN btrim(v_ip);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_invite_preview_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key TEXT;
    v_window TIMESTAMPTZ := date_trunc('hour', NOW());
    v_count INT;
BEGIN
    v_key := public.invite_preview_client_key();
    INSERT INTO public.invite_preview_rate_limits (client_key, window_start, attempt_count)
    VALUES (v_key, v_window, 1)
    ON CONFLICT (client_key, window_start)
    DO UPDATE SET attempt_count = invite_preview_rate_limits.attempt_count + 1
    RETURNING attempt_count INTO v_count;

    IF v_count > 60 THEN
        RAISE EXCEPTION 'invite_preview_rate_limit_exceeded' USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_invite_preview(p_token TEXT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_profile RECORD;
    v_group RECORD;
    v_members JSON;
    v_count INT;
BEGIN
    PERFORM public.enforce_invite_preview_rate_limit();

    IF p_token IS NULL OR length(btrim(p_token)) < 12 THEN
        RETURN json_build_object('kind', 'invalid');
    END IF;

    SELECT id, name, avatar_url INTO v_profile
    FROM profiles WHERE invite_token = p_token LIMIT 1;

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
            JOIN profiles p ON p.id = gm.user_id
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
