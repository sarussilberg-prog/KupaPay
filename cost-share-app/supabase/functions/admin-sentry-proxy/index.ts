// admin-sentry-proxy: admin-gated proxy over the Sentry REST API.
// See docs/superpowers/specs/2026-06-02-error-tracking-with-sentry-design.md §3.

import { handleRequest, type ProxyEnv } from './handler.ts';

const env: ProxyEnv = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    SENTRY_API_TOKEN: Deno.env.get('SENTRY_API_TOKEN') ?? '',
    SENTRY_ORG: Deno.env.get('SENTRY_ORG') ?? '',
    SENTRY_PROJECT_DEV: Deno.env.get('SENTRY_PROJECT_DEV') ?? '',
    SENTRY_PROJECT_PROD: Deno.env.get('SENTRY_PROJECT_PROD') ?? '',
};

Deno.serve((req) => handleRequest(req, env));
