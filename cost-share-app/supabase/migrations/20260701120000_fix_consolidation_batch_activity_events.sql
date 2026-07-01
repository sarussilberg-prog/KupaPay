-- Fix: consolidation-batch settlements must not generate individual
-- settlement_added activity events. Two problems:
--   1. emit_settlement_activity_events had no consolidation_batch_id guard,
--      so inserting 2 batched settlements produced 2 spurious settlement_added
--      rows in the feed.
--   2. Soft-deleting those settlements (via delete_consolidation_batch) then
--      marked those rows is_deleted=true → the feed showed TWO "deleted"
--      settlement cards instead of one.
--
-- Fix:
--   A. Guard emit_settlement_activity_events: skip all branches when the
--      settlement belongs to a batch.
--   B. Add handle_consolidation_batch_delete() trigger: when deleted_at is
--      set on consolidation_batches, mark the consolidation_batch_added events
--      as deleted (so the feed shows exactly ONE deleted card).
--   C. Back-fill: remove any stale settlement_added events that were created
--      for already-batched settlements.

-- ============================================================================
-- A. Patch emit_settlement_activity_events — skip batched settlements
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_settlement_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- Batched settlements must not emit per-settlement activity events.
        -- The batch-level trigger (after_consolidation_batch_insert) already
        -- fires a single consolidation_batch_added event for the whole batch.
        IF NEW.consolidation_batch_id IS NOT NULL THEN
            RETURN NEW;
        END IF;

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

        -- Soft-delete: mark in-place.
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

-- ============================================================================
-- B. New trigger: mark consolidation_batch_added events deleted when
--    the batch itself is soft-deleted.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_consolidation_batch_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only fire when deleted_at transitions NULL → non-NULL.
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE activity_events
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'is_deleted', true,
                'deleted_at', NOW(),
                'deleted_by', auth.uid()
            ),
            created_at = NOW()
        WHERE kind = 'consolidation_batch_added' AND ref_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_consolidation_batch_delete ON consolidation_batches;
CREATE TRIGGER after_consolidation_batch_delete
    AFTER UPDATE OF deleted_at ON consolidation_batches
    FOR EACH ROW EXECUTE FUNCTION handle_consolidation_batch_delete();

-- ============================================================================
-- C. Back-fill: remove stale settlement_added events for batched settlements.
--    These were created before this fix and must not appear in the feed.
-- ============================================================================

DELETE FROM activity_events
WHERE kind = 'settlement_added'
  AND ref_id IN (
      SELECT id FROM settlements WHERE consolidation_batch_id IS NOT NULL
  );
