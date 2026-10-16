-- Hot-path / RLS filter indexes (EXPLAIN guards in rpc_explain_performance.test.sql).
-- Idempotent; safe to re-run on dev/staging.

CREATE INDEX IF NOT EXISTS idx_push_deliveries_recipient_user_id
    ON public.push_deliveries (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_monetization_events_user_id
    ON public.monetization_events (user_id);

CREATE INDEX IF NOT EXISTS idx_settlements_created_by
    ON public.settlements (created_by);

CREATE INDEX IF NOT EXISTS idx_activity_events_actor_user_id
    ON public.activity_events (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_group_messages_user_id
    ON public.group_messages (user_id);
