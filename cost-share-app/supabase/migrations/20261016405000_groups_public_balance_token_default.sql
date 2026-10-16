-- SQL integration tests insert groups with session_replication_role = replica (triggers off).
ALTER TABLE public.groups
    ALTER COLUMN public_balance_token SET DEFAULT public.generate_invite_token();
