-- 2026-07-06 — Per-recipient viewer_delta on expense_added activity events.
--
-- WHY: the Activity screen colors the main amount by the viewer's net effect on
-- the expense (green when owed, red when owing, black when even/uninvolved). The
-- existing expense_added fan-out metadata carried no per-user delta, so activity
-- expenses could not be colored. This migration adds metadata.viewer_delta =
-- paid − share for the row's user_id.
--
-- Two triggers are needed because expense_splits do NOT exist when the AFTER
-- INSERT trigger on `expenses` fires (create_expense_with_splits inserts the
-- expense first, then the splits):
--   1. emit_expense_activity_events (expenses): seed viewer_delta from the
--      payer only — payer paid NEW.amount, everyone else 0 so far.
--   2. emit_expense_split_viewer_delta (expense_splits): once a participant's
--      split lands, correct that recipient's row to paid − share.
--
-- Pre-existing / backfilled rows keep no viewer_delta and render black on the
-- client. New events get colored going forward. Applies dev
-- (drxfbicunusmipdgbgdk) first, then prod (jfqxjjjbpxbwwvoygahu) after approval.

BEGIN;

-- ============================================================================
-- 1. emit_expense_activity_events — seed viewer_delta from the payer.
--    Unchanged from 20260618192600 except the INSERT branch's jsonb payload,
--    which now also writes 'viewer_delta' (payer → NEW.amount, others → 0).
-- ============================================================================
CREATE OR REPLACE FUNCTION emit_expense_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete: fan-out new rows to all active members.
        IF (TG_OP = 'INSERT' AND NEW.is_deleted = false)
           OR (TG_OP = 'UPDATE' AND OLD.is_deleted = true AND NEW.is_deleted = false) THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'expense_added',
                NEW.group_id,
                NEW.id,
                NEW.created_by,
                jsonb_build_object(
                    'description', NEW.description,
                    'amount',      NEW.amount,
                    'currency',    NEW.currency,
                    'expense_date', NEW.expense_date,
                    -- Payer paid the full amount; splits (shares) are applied by
                    -- the expense_splits trigger below. Non-payers start at 0.
                    'viewer_delta',
                        CASE WHEN gm.user_id = NEW.paid_by THEN NEW.amount ELSE 0 END
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit: refresh metadata + bump created_at, and mark is_edited.
        -- Re-seed viewer_delta from the payer; the split trigger re-applies
        -- shares if the amount/splits changed.
        ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = false
              AND (OLD.description  IS DISTINCT FROM NEW.description
                   OR OLD.amount    IS DISTINCT FROM NEW.amount
                   OR OLD.currency  IS DISTINCT FROM NEW.currency
                   OR OLD.expense_date IS DISTINCT FROM NEW.expense_date
                   OR OLD.paid_by IS DISTINCT FROM NEW.paid_by) THEN
            UPDATE activity_events ae
            SET metadata = jsonb_build_object(
                    'description', NEW.description,
                    'amount',      NEW.amount,
                    'currency',    NEW.currency,
                    'expense_date', NEW.expense_date,
                    'is_edited',   true,
                    'edited_at',   NOW(),
                    'viewer_delta',
                        CASE WHEN ae.user_id = NEW.paid_by THEN NEW.amount ELSE 0 END
                        - COALESCE((
                            SELECT es.amount FROM expense_splits es
                            WHERE es.expense_id = NEW.id AND es.user_id = ae.user_id
                        ), 0)
                ),
                created_at = NOW()
            WHERE ae.kind = 'expense_added' AND ae.ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark rows deleted in-place (unchanged).
        IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
            UPDATE activity_events
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'is_deleted', true,
                    'deleted_at', NOW(),
                    'deleted_by', auth.uid()
                ),
                created_at = NOW()
            WHERE kind = 'expense_added' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

-- Trigger definition unchanged; recreate idempotently for safety.
DROP TRIGGER IF EXISTS trg_expense_activity_events ON expenses;
CREATE TRIGGER trg_expense_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, paid_by, description, amount, currency, expense_date ON expenses
    FOR EACH ROW EXECUTE FUNCTION emit_expense_activity_events();

REVOKE EXECUTE ON FUNCTION emit_expense_activity_events() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. emit_expense_split_viewer_delta — correct each participant's row once
--    their split (share) is known. Fires per split row on INSERT/UPDATE.
--    viewer_delta = (row user paid ? expense.amount : 0) − split.amount.
-- ============================================================================
CREATE OR REPLACE FUNCTION emit_expense_split_viewer_delta() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_amount  NUMERIC;
        v_paid_by UUID;
    BEGIN
        SELECT e.amount, e.paid_by INTO v_amount, v_paid_by
        FROM expenses e WHERE e.id = NEW.expense_id;

        IF v_amount IS NULL THEN
            RETURN NEW;  -- expense gone (shouldn't happen inside one txn)
        END IF;

        UPDATE activity_events
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'viewer_delta',
                (CASE WHEN NEW.user_id = v_paid_by THEN v_amount ELSE 0 END) - NEW.amount
            )
        WHERE kind = 'expense_added'
          AND ref_id = NEW.expense_id
          AND user_id = NEW.user_id;

        RETURN NEW;
    END;
    $$;

REVOKE EXECUTE ON FUNCTION emit_expense_split_viewer_delta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_expense_split_viewer_delta ON expense_splits;
CREATE TRIGGER trg_expense_split_viewer_delta
    AFTER INSERT OR UPDATE OF amount, user_id ON expense_splits
    FOR EACH ROW EXECUTE FUNCTION emit_expense_split_viewer_delta();

COMMIT;
