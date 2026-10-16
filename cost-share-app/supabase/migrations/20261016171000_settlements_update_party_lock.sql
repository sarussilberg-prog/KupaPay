-- #298 — Settlement UPDATE: immutable from/to/amount; only parties or creator; active members.

CREATE OR REPLACE FUNCTION public.guard_settlement_core_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
        OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
        OR NEW.amount IS DISTINCT FROM OLD.amount THEN
        RAISE EXCEPTION 'settlement_core_fields_immutable' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_settlement_core_fields ON public.settlements;
CREATE TRIGGER trg_guard_settlement_core_fields
    BEFORE UPDATE ON public.settlements
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_settlement_core_fields();

DROP POLICY IF EXISTS "Either party can update settlement" ON public.settlements;
DROP POLICY IF EXISTS "Group members can update settlements" ON public.settlements;
CREATE POLICY "Group members can update settlements" ON public.settlements
    FOR UPDATE
    USING (
        public.is_caller_active()
        AND public.is_group_member(group_id)
        AND (
            (SELECT auth.uid()) = from_user_id
            OR (SELECT auth.uid()) = to_user_id
            OR (SELECT auth.uid()) = created_by
        )
        AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id
              AND gm.user_id = from_user_id
              AND gm.is_active = TRUE
        )
        AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id
              AND gm.user_id = to_user_id
              AND gm.is_active = TRUE
        )
    )
    WITH CHECK (
        public.is_caller_active()
        AND public.is_group_member(group_id)
        AND (
            (SELECT auth.uid()) = from_user_id
            OR (SELECT auth.uid()) = to_user_id
            OR (SELECT auth.uid()) = created_by
        )
        AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id
              AND gm.user_id = from_user_id
              AND gm.is_active = TRUE
        )
        AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id
              AND gm.user_id = to_user_id
              AND gm.is_active = TRUE
        )
    );
