-- 2026-06-18 — Surface "edited" and "deleted" lifecycle states on activity rows.
--
-- Changes vs. 20260618110000_activity_events_fire_on_edit.sql:
--   1. Edit branch now also writes is_edited=true, edited_at=NOW() into metadata
--      (replaces the existing wholesale jsonb_build_object payload).
--   2. Soft-delete branch switches from DELETE → UPDATE: rows stay in the feed
--      with is_deleted=true, deleted_at=NOW(), deleted_by=auth.uid(), and
--      created_at bumped so the row resurfaces at the top. Uses jsonb || merge
--      so the last-known content (description/amount/...) is preserved for the
--      client's deletion-notice popup.
--   3. New RLS policy lets a user DELETE their own activity_events row, which
--      powers the "Remove from activity" per-user hide.

BEGIN;

-- ============================================================================
-- 1. emit_expense_activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_expense_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete: fan-out new rows to all active members.
        -- Note: with the soft-delete branch now leaving rows in place,
        -- un-delete hits ON CONFLICT DO NOTHING and the row stays as-was
        -- (is_deleted still true). v1 doesn't expose un-delete in the UI.
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
                    'expense_date', NEW.expense_date
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit: refresh metadata + bump created_at, and mark is_edited.
        ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = false
              AND (OLD.description  IS DISTINCT FROM NEW.description
                   OR OLD.amount    IS DISTINCT FROM NEW.amount
                   OR OLD.currency  IS DISTINCT FROM NEW.currency
                   OR OLD.expense_date IS DISTINCT FROM NEW.expense_date) THEN
            UPDATE activity_events
            SET metadata = jsonb_build_object(
                    'description', NEW.description,
                    'amount',      NEW.amount,
                    'currency',    NEW.currency,
                    'expense_date', NEW.expense_date,
                    'is_edited',   true,
                    'edited_at',   NOW()
                ),
                created_at = NOW()
            WHERE kind = 'expense_added' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark rows deleted in-place (was: DELETE).
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

-- Trigger unchanged from 20260618110000 — column-watch already covers the
-- relevant columns; we recreate it idempotently for safety.
DROP TRIGGER IF EXISTS trg_expense_activity_events ON expenses;
CREATE TRIGGER trg_expense_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, description, amount, currency, expense_date ON expenses
    FOR EACH ROW EXECUTE FUNCTION emit_expense_activity_events();

-- ============================================================================
-- 2. emit_settlement_activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_settlement_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete.
        IF (TG_OP = 'INSERT' AND NEW.deleted_at IS NULL)
           OR (TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'settlement_added',
                NEW.group_id,
                NEW.id,
                NEW.created_by,
                jsonb_build_object(
                    'from_user_id',     NEW.from_user_id,
                    'to_user_id',       NEW.to_user_id,
                    'amount',           NEW.amount,
                    'currency',         NEW.currency,
                    'settlement_date',  NEW.settlement_date
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit.
        ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL
              AND (OLD.from_user_id IS DISTINCT FROM NEW.from_user_id
                   OR OLD.to_user_id   IS DISTINCT FROM NEW.to_user_id
                   OR OLD.amount       IS DISTINCT FROM NEW.amount
                   OR OLD.currency     IS DISTINCT FROM NEW.currency) THEN
            UPDATE activity_events
            SET metadata = jsonb_build_object(
                    'from_user_id',     NEW.from_user_id,
                    'to_user_id',       NEW.to_user_id,
                    'amount',           NEW.amount,
                    'currency',         NEW.currency,
                    'settlement_date',  NEW.settlement_date,
                    'is_edited',        true,
                    'edited_at',        NOW()
                ),
                created_at = NOW()
            WHERE kind = 'settlement_added' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark in-place (was: DELETE).
        IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            UPDATE activity_events
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'is_deleted', true,
                    'deleted_at', NOW(),
                    'deleted_by', auth.uid()
                ),
                created_at = NOW()
            WHERE kind = 'settlement_added' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_settlement_activity_events ON settlements;
CREATE TRIGGER trg_settlement_activity_events
    AFTER INSERT OR UPDATE OF deleted_at, from_user_id, to_user_id, amount, currency ON settlements
    FOR EACH ROW EXECUTE FUNCTION emit_settlement_activity_events();

-- ============================================================================
-- 3. emit_message_activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_message_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete.
        IF (TG_OP = 'INSERT' AND NEW.is_deleted = false)
           OR (TG_OP = 'UPDATE' AND OLD.is_deleted = true AND NEW.is_deleted = false) THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'message_posted',
                NEW.group_id,
                NEW.id,
                NEW.user_id,
                jsonb_build_object('body', LEFT(NEW.body, 200)),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit.
        ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = false
              AND OLD.body IS DISTINCT FROM NEW.body THEN
            UPDATE activity_events
            SET metadata   = jsonb_build_object(
                    'body',      LEFT(NEW.body, 200),
                    'is_edited', true,
                    'edited_at', NOW()
                ),
                created_at = NOW()
            WHERE kind = 'message_posted' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark in-place (was: DELETE).
        IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
            UPDATE activity_events
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'is_deleted', true,
                    'deleted_at', NOW(),
                    'deleted_by', auth.uid()
                ),
                created_at = NOW()
            WHERE kind = 'message_posted' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_message_activity_events ON group_messages;
CREATE TRIGGER trg_message_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, body ON group_messages
    FOR EACH ROW EXECUTE FUNCTION emit_message_activity_events();

-- ============================================================================
-- 4. RLS — let users DELETE their own activity_events row
-- ============================================================================

DROP POLICY IF EXISTS activity_events_delete_own ON public.activity_events;
CREATE POLICY activity_events_delete_own
    ON public.activity_events
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

COMMIT;
