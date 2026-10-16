DO $test$
BEGIN
    IF to_regprocedure('public.get_group_spending_by_category(uuid,character varying)') IS NULL THEN
        RAISE EXCEPTION 'get_group_spending_by_category missing';
    END IF;
    IF to_regprocedure('public.get_group_spending_by_member(uuid,character varying)') IS NULL THEN
        RAISE EXCEPTION 'get_group_spending_by_member missing';
    END IF;
    IF to_regprocedure('public.get_group_spending_by_week(uuid,character varying)') IS NULL THEN
        RAISE EXCEPTION 'get_group_spending_by_week missing';
    END IF;
END;
$test$;
