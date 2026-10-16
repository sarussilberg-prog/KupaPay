-- SQL integration tests insert groups with session_replication_role = replica (triggers off).
-- Provide a column default so NOT NULL public_balance_token is satisfied without the BEFORE INSERT trigger.

ALTER TABLE public.groups
    ALTER COLUMN public_balance_token SET DEFAULT public.generate_invite_token();
