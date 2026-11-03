import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';
import { createInstrumentedFetch } from './instrumentedFetch';
import { isE2eLayoutFixturesEnabled } from './e2eLayoutFixtures';

const fixtureFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/auth/v1/health')) {
        return new Response(JSON.stringify({ version: 'e2e-fixture', name: 'GoTrue' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    console.warn(`[E2E_FIXTURE] blocked fetch: ${url}`);
    return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

const networkFetch =
    process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()
        ? createInstrumentedFetch(fetch)
        : fetch;

const globalFetch = isE2eLayoutFixturesEnabled() ? fixtureFetch : networkFetch;

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || 'https://drxfbicunusmipdgbgdk.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyeGZiaWN1bnVzbWlwZGdiZ2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDB9.dev-screenshot-fallback';

if (
  process.env.EXPO_PUBLIC_E2E_MAESTRO_AUTH === 'true' &&
  !isE2eLayoutFixturesEnabled()
) {
  try {
    console.log(`[MAESTRO_SUPABASE_HOST] ${new URL(supabaseUrl).hostname}`);
  } catch {
    console.log('[MAESTRO_SUPABASE_HOST] invalid-url');
  }
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      fetch: globalFetch,
    },
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  }
);
