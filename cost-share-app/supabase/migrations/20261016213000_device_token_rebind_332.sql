-- #332 — Do not rebind an active Expo token from another user.

CREATE OR REPLACE FUNCTION register_device_token(
    p_token       TEXT,
    p_platform    TEXT,
    p_device_id   TEXT DEFAULT NULL,
    p_app_version TEXT DEFAULT NULL
) RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_user UUID := auth.uid();
        v_owner UUID;
        v_disabled TIMESTAMPTZ;
    BEGIN
        IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
        IF p_platform NOT IN ('ios','android') THEN RAISE EXCEPTION 'bad_platform'; END IF;
        IF p_token IS NULL OR btrim(p_token) = '' THEN RAISE EXCEPTION 'bad_token'; END IF;

        SELECT user_id, disabled_at INTO v_owner, v_disabled
        FROM device_tokens
        WHERE token = p_token;

        IF FOUND THEN
            IF v_owner IS DISTINCT FROM v_user AND v_disabled IS NULL THEN
                RAISE EXCEPTION 'token_bound_to_other_user' USING ERRCODE = '42501';
            END IF;

            UPDATE device_tokens
               SET user_id         = v_user,
                   platform        = p_platform,
                   device_id       = p_device_id,
                   app_version     = p_app_version,
                   last_seen_at    = NOW(),
                   disabled_at     = NULL,
                   disabled_reason = NULL
             WHERE token = p_token;
            RETURN;
        END IF;

        INSERT INTO device_tokens (user_id, token, platform, device_id, app_version, last_seen_at)
        VALUES (v_user, p_token, p_platform, p_device_id, p_app_version, NOW());
    END;
    $$;

REVOKE EXECUTE ON FUNCTION register_device_token(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_device_token(TEXT,TEXT,TEXT,TEXT) TO authenticated;
