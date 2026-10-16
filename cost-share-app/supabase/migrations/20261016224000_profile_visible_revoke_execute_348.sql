-- #348 — profile_visible_to_viewer is for RLS only; not a client membership oracle.

REVOKE EXECUTE ON FUNCTION public.profile_visible_to_viewer(UUID) FROM authenticated;
