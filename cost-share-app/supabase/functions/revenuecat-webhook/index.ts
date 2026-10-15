import { handleRequest, type WebhookEnv } from './handler.ts';

const env: WebhookEnv = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    REVENUECAT_WEBHOOK_SECRET: Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '',
};

Deno.serve((req) => handleRequest(req, env));
