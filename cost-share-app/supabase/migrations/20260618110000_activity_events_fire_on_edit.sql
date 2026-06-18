-- 2026-06-18 — Fire activity + push notifications when an expense, settlement,
-- or message is edited (content change), not only when created or deleted.
--
-- Problem: triggers previously watched only `is_deleted`/`deleted_at`, so
-- editing description/amount/body left activity_events stale and skipped push.
--
-- Fix:
--   1. Each source trigger: add an ELSIF branch that UPDATEs existing
--      activity_events rows (bumping created_at) when content columns change.
--   2. Widen each trigger's column-watch list to include editable content cols.
--   3. Extend trg_push_send_on_activity_event to fire on activity_events UPDATE
--      iff created_at actually changed (avoids duplicate push for friend-request
--      status updates, which UPDATE metadata but leave created_at alone).

BEGIN;

-- ============================================================================
-- 1. emit_expense_activity_events — handle content edits
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
                    'expense_date', NEW.expense_date
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit: refresh metadata + bump created_at so the event
        -- resurfaces at the top of the feed and re-triggers push.
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
                    'expense_date', NEW.expense_date
                ),
                created_at = NOW()
            WHERE kind = 'expense_added' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: remove all activity rows for this expense.
        IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
            DELETE FROM activity_events WHERE kind = 'expense_added' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_expense_activity_events ON expenses;
CREATE TRIGGER trg_expense_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, description, amount, currency, expense_date ON expenses
    FOR EACH ROW EXECUTE FUNCTION emit_expense_activity_events();

-- ============================================================================
-- 2. emit_settlement_activity_events — handle content edits
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
                    'settlement_date',  NEW.settlement_date
                ),
                created_at = NOW()
            WHERE kind = 'settlement_added' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete.
        IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            DELETE FROM activity_events WHERE kind = 'settlement_added' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_settlement_activity_events ON settlements;
CREATE TRIGGER trg_settlement_activity_events
    AFTER INSERT OR UPDATE OF deleted_at, from_user_id, to_user_id, amount, currency ON settlements
    FOR EACH ROW EXECUTE FUNCTION emit_settlement_activity_events();

-- ============================================================================
-- 3. emit_message_activity_events — handle content edits
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
            SET metadata   = jsonb_build_object('body', LEFT(NEW.body, 200)),
                created_at = NOW()
            WHERE kind = 'message_posted' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete.
        IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
            DELETE FROM activity_events WHERE kind = 'message_posted' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_message_activity_events ON group_messages;
CREATE TRIGGER trg_message_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, body ON group_messages
    FOR EACH ROW EXECUTE FUNCTION emit_message_activity_events();

-- ============================================================================
-- 4. Push trigger — split into two: one for INSERT, one for UPDATE.
--    PostgreSQL does not allow WHEN clauses on INSERT triggers to reference OLD.
--    The UPDATE trigger fires only when created_at bumps (content-edit path),
--    preventing double-push on friend-request status updates that only
--    touch metadata without changing created_at.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_push_send_on_activity_event ON activity_events;
DROP TRIGGER IF EXISTS trg_push_send_on_activity_event_update ON activity_events;

-- Existing INSERT trigger (unchanged logic).
CREATE TRIGGER trg_push_send_on_activity_event
    AFTER INSERT ON activity_events
    FOR EACH ROW
    WHEN (NEW.actor_user_id IS NOT NULL AND NEW.actor_user_id IS DISTINCT FROM NEW.user_id)
    EXECUTE FUNCTION app_private.push_send_on_activity_event();

-- New UPDATE trigger: fires only when created_at changed (content edit).
CREATE TRIGGER trg_push_send_on_activity_event_update
    AFTER UPDATE ON activity_events
    FOR EACH ROW
    WHEN (NEW.actor_user_id IS NOT NULL
      AND NEW.actor_user_id IS DISTINCT FROM NEW.user_id
      AND OLD.created_at IS DISTINCT FROM NEW.created_at)
    EXECUTE FUNCTION app_private.push_send_on_activity_event();

COMMIT;
