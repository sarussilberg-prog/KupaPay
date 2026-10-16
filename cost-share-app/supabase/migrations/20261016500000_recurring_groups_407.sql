-- #407 Recurring groups: monthly roommates/bills mode (free view; automation stays Pro).

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS monthly_bills_mode BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS billing_cycle_day SMALLINT NOT NULL DEFAULT 1
        CHECK (billing_cycle_day >= 1 AND billing_cycle_day <= 28);

COMMENT ON COLUMN public.groups.monthly_bills_mode IS
    'When true, group detail shows monthly cycle view and bill reminders (#407).';
COMMENT ON COLUMN public.groups.billing_cycle_day IS
    'Day-of-month (1–28) when the shared bills cycle starts.';

-- Enable monthly mode by default for new home groups.
CREATE OR REPLACE FUNCTION public.default_home_monthly_bills_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.group_type = 'home' AND NEW.monthly_bills_mode IS NOT DISTINCT FROM FALSE THEN
        NEW.monthly_bills_mode := TRUE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_home_monthly_bills ON public.groups;
CREATE TRIGGER trg_default_home_monthly_bills
    BEFORE INSERT ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.default_home_monthly_bills_mode();

UPDATE public.groups
SET monthly_bills_mode = TRUE
WHERE group_type = 'home' AND monthly_bills_mode = FALSE;
