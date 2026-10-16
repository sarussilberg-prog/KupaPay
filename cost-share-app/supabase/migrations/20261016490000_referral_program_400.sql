-- #400 Referral program — friend invite attribution + Pro promotional reward.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referee_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'qualified', 'rewarded', 'rejected')),
    qualified_at    TIMESTAMPTZ,
    rewarded_at     TIMESTAMPTZ,
    reject_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referrer_id, referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON public.referral_rewards(status);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own referral rewards"
    ON public.referral_rewards FOR SELECT
    TO authenticated
    USING (referrer_id = auth.uid() OR referee_id = auth.uid());

CREATE OR REPLACE FUNCTION public._attribute_referral(p_referrer UUID, p_referee UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_referrer IS NULL OR p_referee IS NULL OR p_referrer = p_referee THEN
        RETURN;
    END IF;
    UPDATE public.profiles
       SET referred_by_user_id = p_referrer
     WHERE id = p_referee AND referred_by_user_id IS NULL;

    INSERT INTO public.referral_rewards (referrer_id, referee_id, status)
    VALUES (p_referrer, p_referee, 'pending')
    ON CONFLICT (referrer_id, referee_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_friend_invite(p_token TEXT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    FROM profiles WHERE invite_token = p_token LIMIT 1;

    IF v_inviter_id IS NULL THEN
        RAISE EXCEPTION 'invite_not_found';
    END IF;
    IF v_inviter_id = v_me THEN
        RAISE EXCEPTION 'cannot_self_invite';
    END IF;

    PERFORM public._attribute_referral(v_inviter_id, v_me);

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

CREATE OR REPLACE FUNCTION public.referral_on_expense_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referrer UUID;
    v_member_count int;
BEGIN
    SELECT referred_by_user_id INTO v_referrer FROM profiles WHERE id = NEW.created_by;
    IF v_referrer IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)::int INTO v_member_count
    FROM group_members gm
    WHERE gm.group_id = NEW.group_id AND gm.is_active = TRUE;

    IF v_member_count < 2 THEN
        RETURN NEW;
    END IF;

    UPDATE referral_rewards
       SET status = 'qualified', qualified_at = NOW()
     WHERE referrer_id = v_referrer
       AND referee_id = NEW.created_by
       AND status = 'pending';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_on_expense ON public.expenses;
CREATE TRIGGER trg_referral_on_expense
    AFTER INSERT ON public.expenses
    FOR EACH ROW
    WHEN (NEW.is_deleted = FALSE)
    EXECUTE FUNCTION public.referral_on_expense_created();

CREATE OR REPLACE FUNCTION public.get_my_referral_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_rewards jsonb;
    v_year_count int;
BEGIN
    IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'referee_id', r.referee_id,
        'status', r.status,
        'qualified_at', r.qualified_at,
        'rewarded_at', r.rewarded_at
    ) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_rewards
    FROM referral_rewards r
    WHERE r.referrer_id = v_me
    LIMIT 50;

    SELECT COUNT(*)::int INTO v_year_count
    FROM referral_rewards
    WHERE referrer_id = v_me
      AND status = 'rewarded'
      AND rewarded_at > NOW() - INTERVAL '365 days';

    RETURN jsonb_build_object(
        'invite_token', (SELECT invite_token FROM profiles WHERE id = v_me),
        'rewards', v_rewards,
        'rewards_this_year', v_year_count,
        'annual_cap', 12
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_referral_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_referral_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.run_referral_reward_dispatch(p_limit INT DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
    v_out jsonb := '[]'::jsonb;
    v_year int;
BEGIN
    FOR v_row IN
        SELECT r.id, r.referrer_id, r.referee_id
        FROM referral_rewards r
        WHERE r.status = 'qualified'
        ORDER BY r.qualified_at ASC
        LIMIT GREATEST(p_limit, 1)
    LOOP
        SELECT COUNT(*)::int INTO v_year
        FROM referral_rewards
        WHERE referrer_id = v_row.referrer_id
          AND status = 'rewarded'
          AND rewarded_at > NOW() - INTERVAL '365 days';

        IF v_year >= 12 THEN
            UPDATE referral_rewards SET status = 'rejected', reject_reason = 'annual_cap' WHERE id = v_row.id;
            CONTINUE;
        END IF;

        v_out := v_out || jsonb_build_array(jsonb_build_object(
            'reward_id', v_row.id,
            'referrer_id', v_row.referrer_id,
            'referee_id', v_row.referee_id
        ));
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'items', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.run_referral_reward_dispatch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_referral_reward_dispatch(INT) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_referral_rewarded(p_reward_id UUID, p_ok BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_ok THEN
        UPDATE referral_rewards
           SET status = 'rewarded', rewarded_at = NOW(), reject_reason = NULL
         WHERE id = p_reward_id;
    ELSE
        UPDATE referral_rewards
           SET status = 'rejected', reject_reason = COALESCE(p_reason, 'grant_failed')
         WHERE id = p_reward_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_referral_rewarded(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_referral_rewarded(UUID, BOOLEAN, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION app_private.invoke_referral_reward_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_url    TEXT;
    v_secret TEXT;
BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'referral_reward_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'referral_reward_webhook_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'referral_reward_dispatch: vault URL/secret not configured — skip';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
END;
$$;

DO $cron$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'referral-reward-dispatch-hourly' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'referral-reward-dispatch-hourly',
    '15 * * * *',
    $$SELECT app_private.invoke_referral_reward_dispatch();$$
);

REVOKE EXECUTE ON FUNCTION public.redeem_friend_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_friend_invite(TEXT) TO authenticated;
