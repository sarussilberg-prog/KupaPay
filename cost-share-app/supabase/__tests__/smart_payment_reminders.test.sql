DO $test$
BEGIN
    IF to_regprocedure('public.set_group_smart_reminder(uuid,boolean,integer)') IS NULL THEN
        RAISE EXCEPTION 'set_group_smart_reminder missing';
    END IF;
    IF to_regprocedure('public.run_smart_payment_reminders(integer)') IS NULL THEN
        RAISE EXCEPTION 'run_smart_payment_reminders missing';
    END IF;
END;
$test$;
