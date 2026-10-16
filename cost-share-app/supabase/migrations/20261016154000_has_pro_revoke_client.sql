-- #210 — Clients use get_my_pro_status(); has_pro is service_role / internal only.

REVOKE EXECUTE ON FUNCTION public.has_pro(UUID, UUID) FROM authenticated;
