-- Smoke + signature checks for recurring expense Pro RPCs (#167).

DO $test$
BEGIN
    IF to_regprocedure('public.create_recurring_expense_series(uuid,text,numeric,text,text,date,text,uuid,text,jsonb,text,text)') IS NULL THEN
        RAISE EXCEPTION 'create_recurring_expense_series missing';
    END IF;
    IF to_regprocedure('public.generate_due_recurring_expenses(integer)') IS NULL THEN
        RAISE EXCEPTION 'generate_due_recurring_expenses missing';
    END IF;
    IF to_regprocedure('public.stop_recurring_expense_series(uuid)') IS NULL THEN
        RAISE EXCEPTION 'stop_recurring_expense_series missing';
    END IF;
    IF to_regclass('public.recurring_expense_series') IS NULL THEN
        RAISE EXCEPTION 'recurring_expense_series table missing';
    END IF;
END;
$test$;
