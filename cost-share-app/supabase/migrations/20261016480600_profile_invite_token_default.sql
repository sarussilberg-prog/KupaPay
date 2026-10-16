-- SQL tests (replica role): keep invite_token DEFAULT when triggers are disabled.

ALTER TABLE public.profiles
    ALTER COLUMN invite_token SET DEFAULT public.generate_invite_token();
