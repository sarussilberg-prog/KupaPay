DO $test$
BEGIN
    IF to_regprocedure('public.set_group_trip_budget(uuid,numeric,character varying)') IS NULL THEN
        RAISE EXCEPTION 'set_group_trip_budget missing';
    END IF;
    IF to_regprocedure('public.evaluate_trip_budget_alerts(uuid)') IS NULL THEN
        RAISE EXCEPTION 'evaluate_trip_budget_alerts missing';
    END IF;
END;
$test$;
