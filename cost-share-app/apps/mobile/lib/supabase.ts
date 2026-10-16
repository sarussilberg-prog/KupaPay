import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';
import { createInstrumentedFetch } from './instrumentedFetch';

const globalFetch =
    process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()
        ? createInstrumentedFetch(fetch)
        : fetch;

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
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
