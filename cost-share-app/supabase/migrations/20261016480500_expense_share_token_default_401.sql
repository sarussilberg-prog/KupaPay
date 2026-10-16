-- #401 follow-up: keep share_token DEFAULT for SQL tests (session_replication_role=replica disables triggers).

ALTER TABLE public.expenses
    ALTER COLUMN share_token SET DEFAULT public.generate_invite_token();
