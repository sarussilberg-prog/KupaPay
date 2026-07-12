-- Add consolidation_batch_added to the activity_events.kind CHECK constraint.
-- Must match the ActivityEventKind union in packages/shared/src/types/index.ts.
ALTER TABLE activity_events
    DROP CONSTRAINT IF EXISTS activity_events_kind_check;

ALTER TABLE activity_events
    ADD CONSTRAINT activity_events_kind_check CHECK (kind IN (
        'expense_added',
        'settlement_added',
        'message_posted',
        'friend_request_received',
        'group_added',
        'group_member_joined',
        'group_removed',
        'group_created',
        'group_deleted',
        'group_note_changed',
        'settle_up_reminder',
        'consolidation_batch_added'
    ));
