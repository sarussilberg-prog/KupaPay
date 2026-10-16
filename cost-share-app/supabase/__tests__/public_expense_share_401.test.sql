BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group UUID := '00000000-0000-0000-0000-000000004010';
    v_user UUID := '00000000-0000-0000-0000-000000004011';
    v_expense UUID := '00000000-0000-0000-0000-000000004012';
    v_token TEXT := 'tt_expshare01';
    v_json JSON;
BEGIN
    INSERT INTO public.profiles (id, name, is_active, invite_token)
    VALUES (v_user, 'Payer', TRUE, 'it_exp401_payer');
    INSERT INTO public.groups (id, name, created_by, default_currency, invite_token)
    VALUES (v_group, 'Share test', v_user, 'ILS', 'tt_grp401xxx');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_user, TRUE);
    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by, share_token
    )
    VALUES (v_expense, v_group, 'Coffee', 12.50, 'ILS', CURRENT_DATE, v_user, v_user, v_token);

    v_json := public.get_public_expense_share_page(v_token);
    IF (v_json->>'ok')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'expected ok preview';
    END IF;
    IF v_json->>'description' <> 'Coffee' THEN
        RAISE EXCEPTION 'wrong description';
    END IF;
END $outer$;

ROLLBACK;
