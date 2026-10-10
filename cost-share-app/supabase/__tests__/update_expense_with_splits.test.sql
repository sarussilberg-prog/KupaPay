-- Smoke test: update_expense_with_splits is present (run manually / MCP on dev).
-- Full ledger assertions belong in integration tests with seeded groups.

DO $test$
BEGIN
    IF to_regprocedure('public.update_expense_with_splits(uuid,jsonb,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'update_expense_with_splits(uuid,jsonb,jsonb) missing';
    END IF;
END;
$test$;
