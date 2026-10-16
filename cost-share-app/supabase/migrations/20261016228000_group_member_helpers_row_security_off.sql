-- #343 / #348 — SECURITY DEFINER membership helpers must bypass RLS on group_members
-- (avoids infinite recursion when other policies read profiles → group_members).

ALTER FUNCTION public.is_group_member(uuid) SET row_security = off;
ALTER FUNCTION public.is_group_creator(uuid) SET row_security = off;
ALTER FUNCTION public.profile_visible_to_viewer(uuid) SET row_security = off;
