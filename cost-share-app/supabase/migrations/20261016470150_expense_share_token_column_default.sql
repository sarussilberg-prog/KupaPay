-- #401 follow-up: SQL integration tests seed expenses under session_replication_role
-- = replica, which skips BEFORE INSERT triggers. A column DEFAULT covers omitted share_token.

ALTER TABLE public.expenses
    ALTER COLUMN share_token SET DEFAULT public.generate_invite_token();
