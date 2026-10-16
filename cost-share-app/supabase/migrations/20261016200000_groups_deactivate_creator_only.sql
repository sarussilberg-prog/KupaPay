-- #318 — Soft-delete (groups.is_active = false) only by group creator.

CREATE OR REPLACE FUNCTION public.guard_groups_is_active_deactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active
        AND NEW.is_active = FALSE
        AND auth.uid() IS NOT NULL
        AND NOT public.is_group_creator(NEW.id) THEN
        RAISE EXCEPTION 'group_deactivate_creator_only' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_groups_is_active_deactivate ON public.groups;
CREATE TRIGGER trg_guard_groups_is_active_deactivate
    BEFORE UPDATE OF is_active ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_groups_is_active_deactivate();
