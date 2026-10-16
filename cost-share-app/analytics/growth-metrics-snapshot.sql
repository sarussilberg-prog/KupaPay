-- North-star + active expense author counts (ops / weekly report). No PII.
-- Requires SQL access to the project database (dev or prod).

SELECT public.get_growth_metrics() AS growth_metrics;
