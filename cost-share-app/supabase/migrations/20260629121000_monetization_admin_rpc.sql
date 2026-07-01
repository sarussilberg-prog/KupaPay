-- get_monetization_metrics: admin-only analytics RPC
CREATE OR REPLACE FUNCTION get_monetization_metrics()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_funnel     JSONB;
    v_by_feature JSONB;
    v_by_platform JSONB;
    v_daily      JSONB;
BEGIN
    IF NOT is_app_admin() THEN
        RAISE EXCEPTION 'not_admin';
    END IF;

    SELECT jsonb_build_object(
        'ad_gate_shown',           COUNT(*) FILTER (WHERE event_type = 'ad_gate_shown'),
        'ad_gate_watch_tapped',    COUNT(*) FILTER (WHERE event_type = 'ad_gate_watch_tapped'),
        'ad_gate_watch_completed', COUNT(*) FILTER (WHERE event_type = 'ad_gate_watch_completed'),
        'ad_gate_pro_tapped',      COUNT(*) FILTER (WHERE event_type = 'ad_gate_pro_tapped'),
        'remind_sent',             COUNT(*) FILTER (WHERE event_type = 'remind_sent')
    ) INTO v_funnel FROM monetization_events;

    SELECT COALESCE(jsonb_object_agg(feature_key, counts), '{}'::JSONB)
    INTO v_by_feature
    FROM (
        SELECT feature_key,
               jsonb_build_object(
                   'ad_gate_shown',           COUNT(*) FILTER (WHERE event_type = 'ad_gate_shown'),
                   'ad_gate_watch_tapped',    COUNT(*) FILTER (WHERE event_type = 'ad_gate_watch_tapped'),
                   'ad_gate_watch_completed', COUNT(*) FILTER (WHERE event_type = 'ad_gate_watch_completed'),
                   'ad_gate_pro_tapped',      COUNT(*) FILTER (WHERE event_type = 'ad_gate_pro_tapped'),
                   'remind_sent',             COUNT(*) FILTER (WHERE event_type = 'remind_sent')
               ) AS counts
        FROM monetization_events
        GROUP BY feature_key
    ) t;

    SELECT COALESCE(jsonb_object_agg(platform, cnt), '{}'::JSONB)
    INTO v_by_platform
    FROM (
        SELECT platform, COUNT(*) AS cnt
        FROM monetization_events
        GROUP BY platform
    ) t;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date',                    TO_CHAR(day, 'YYYY-MM-DD'),
            'ad_gate_shown',           COUNT(*) FILTER (WHERE event_type = 'ad_gate_shown'),
            'ad_gate_watch_completed', COUNT(*) FILTER (WHERE event_type = 'ad_gate_watch_completed'),
            'remind_sent',             COUNT(*) FILTER (WHERE event_type = 'remind_sent')
        )
        ORDER BY day
    ), '[]'::JSONB)
    INTO v_daily
    FROM (
        SELECT DATE_TRUNC('day', created_at) AS day, event_type
        FROM monetization_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
    ) t
    GROUP BY day;

    RETURN jsonb_build_object(
        'funnel',      v_funnel,
        'by_feature',  v_by_feature,
        'by_platform', v_by_platform,
        'daily',       v_daily
    );
END;
$$;
