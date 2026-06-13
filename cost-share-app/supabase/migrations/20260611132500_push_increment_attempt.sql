-- Atomic failure bookkeeping for push_deliveries (called by send-push service role).
CREATE OR REPLACE FUNCTION increment_push_attempt(p_event_id UUID, p_error TEXT) RETURNS VOID
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
        UPDATE push_deliveries
           SET status = 'failed', attempts = attempts + 1, last_error = p_error
         WHERE activity_event_id = p_event_id;
    $$;

REVOKE EXECUTE ON FUNCTION increment_push_attempt(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_push_attempt(UUID, TEXT) TO service_role;
