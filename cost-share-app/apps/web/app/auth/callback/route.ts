import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Native app deep-link scheme — must match app.json "scheme".
const APP_SCHEME = 'com.kupapay.mobile';
const APP_AUTH_CALLBACK = `${APP_SCHEME}://auth/callback`;

/**
 * OAuth callback for the marketing/web site.
 *
 * The web app has no logged-in surface of its own — the real product is the
 * native app. So after exchanging the PKCE code we hand the session off to the
 * installed app via a deep link. A server-side 302 to a custom scheme breaks
 * desktop browsers ("unknown protocol"), so instead we return a small HTML page
 * that:
 *   - on mobile, opens `com.kupapay.mobile://auth/callback#access_token=…` so the
 *     app's handleAuthRedirectUrl() can call supabase.auth.setSession();
 *   - on desktop / when the app isn't installed, shows a graceful fallback.
 *
 * Tokens travel in the URL *fragment* (never the query string) so they are not
 * sent to any server and stay out of request logs. The native parser
 * (expo-auth-session getQueryParams) merges hash params, so setSession still works.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const webFallback = new URL(next, origin).toString();

  if (!code) {
    return NextResponse.redirect(webFallback);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(webFallback);
  }

  const { access_token, refresh_token } = data.session;
  const tokenParams = new URLSearchParams({ access_token, refresh_token, token_type: 'bearer' });
  const appLink = `${APP_AUTH_CALLBACK}#${tokenParams.toString()}`;

  return new NextResponse(handoffHtml(appLink, webFallback), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Carries a session — never cache.
      'cache-control': 'no-store',
    },
  });
}

function handoffHtml(appLink: string, webFallback: string): string {
  // JSON.stringify produces a safe JS string literal; both values are
  // percent-encoded URLs (no raw </script> possible).
  const appLinkJs = JSON.stringify(appLink);
  const webFallbackJs = JSON.stringify(webFallback);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>KupaPay</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #ffffff; padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
    }
    .card { width: 100%; max-width: 360px; text-align: center; }
    .brand { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; color: #2563eb; margin: 0 0 24px; }
    .spinner {
      width: 40px; height: 40px; margin: 0 auto 20px; border-radius: 50%;
      border: 3px solid #dbeafe; border-top-color: #2563eb; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 1.15rem; font-weight: 700; margin: 0 0 8px; }
    p { font-size: 0.95rem; color: #6B7280; margin: 0 0 24px; line-height: 1.5; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      height: 52px; width: 100%; max-width: 320px; border-radius: 999px; border: none;
      background: #2563eb; color: #ffffff; font-size: 1rem; font-weight: 700;
      text-decoration: none; cursor: pointer; box-shadow: 0 8px 20px rgba(37,99,235,0.25);
    }
    .link { display: inline-block; margin-top: 16px; color: #6B7280; font-size: 0.9rem; text-decoration: none; }
    .link:hover { color: #111827; }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">KupaPay</div>
    <div id="loading">
      <div class="spinner" role="status" aria-label="Opening the app"></div>
      <h1>Opening KupaPay…</h1>
      <p>Taking you into the app.</p>
    </div>
    <div id="fallback" hidden>
      <h1>You're signed in</h1>
      <p>Open the KupaPay app to continue. On a computer? Continue on your phone.</p>
      <a id="openApp" class="btn" href="#">Open KupaPay</a>
      <br />
      <a id="home" class="link" href="#">Back to home</a>
    </div>
  </div>
  <script>
    (function () {
      var appLink = ${appLinkJs};
      var webFallback = ${webFallbackJs};
      var opened = false;

      document.getElementById('openApp').setAttribute('href', appLink);
      document.getElementById('home').setAttribute('href', webFallback);

      function reveal() {
        if (opened) return;
        document.getElementById('loading').setAttribute('hidden', '');
        document.getElementById('fallback').removeAttribute('hidden');
      }

      // If the app opens, the page is backgrounded — cancel the fallback.
      function markOpened() { opened = true; }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) markOpened();
      });
      window.addEventListener('pagehide', markOpened);
      window.addEventListener('blur', markOpened);

      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      if (isMobile) {
        // Try to open the native app, then reveal the manual fallback if nothing happened.
        window.location.href = appLink;
        setTimeout(reveal, 1500);
      } else {
        // Desktop has no app to hand off to — show the fallback right away.
        reveal();
      }
    })();
  </script>
</body>
</html>`;
}
