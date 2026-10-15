-- Minimal Supabase-like stubs for Gate B SQL CI (plain Postgres 17 container).
-- Real dev/prod use hosted Supabase; this only satisfies __tests__ and patch SQL.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  banned_until TIMESTAMPTZ,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  user_id TEXT NOT NULL,
  session_id UUID,
  token TEXT,
  revoked BOOLEAN DEFAULT FALSE
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = auth, public
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION extensions.digest(data TEXT, type TEXT)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT digest(data, type);
$$;

CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(n INTEGER)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT gen_random_bytes(n);
$$;
