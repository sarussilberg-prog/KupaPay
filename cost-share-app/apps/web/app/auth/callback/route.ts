import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Native app deep-link scheme — must match app.json "scheme"
const APP_SCHEME = 'com.kupapay.mobile';
const APP_AUTH_CALLBACK = `${APP_SCHEME}://auth/callback`;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { access_token, refresh_token } = data.session;
      // Hand off session to native app via deep link.
      // The app's handleAuthRedirectUrl() reads access_token + refresh_token
      // and calls supabase.auth.setSession() to sign the user in natively.
      const params = new URLSearchParams({ access_token, refresh_token, token_type: 'bearer' });
      return NextResponse.redirect(`${APP_AUTH_CALLBACK}?${params.toString()}`);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
