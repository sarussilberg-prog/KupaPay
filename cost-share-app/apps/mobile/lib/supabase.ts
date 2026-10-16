import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';
import { createInstrumentedFetch } from './instrumentedFetch';

const globalFetch =
    process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()
        ? createInstrumentedFetch(fetch)
        : fetch;

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || 'https://drxfbicunusmipdgbgdk.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyeGZiaWN1bnVzbWlwZGdiZ2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDB9.dev-screenshot-fallback';

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
