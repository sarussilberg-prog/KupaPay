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

-- SQL regression tests: set Supabase-like JWT + authenticated role for RPC auth checks.
CREATE OR REPLACE FUNCTION public.test_set_jwt_sub(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, TRUE);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id::text)::text, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.test_set_authenticated(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.test_set_jwt_sub(p_user_id);
  PERFORM set_config('role', 'authenticated', TRUE);
END;
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
