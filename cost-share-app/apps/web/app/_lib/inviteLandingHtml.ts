// Interstitial page served by Next.js for invite links /i/<token> and /g/<token>.
//
// WHY this lives in Next.js (not the Supabase edge function):
// the *.supabase.co gateway rewrites any HTML response to text/plain + nosniff
// (anti-phishing), so a page served from the function renders as raw text and
// its script never runs. Served from kupa-pay.com (Vercel) it is real text/html.
//
// WHAT it does: when the OS does NOT intercept the link with a Universal Link /
// App Link — which is exactly what happens inside in-app browsers such as
// WhatsApp — the browser loads this page. The inline script reads the invite
// kind + token from the URL and opens the app via the custom scheme
// (com.kupapay.mobile://invite/<kind>/<token>, the contract in
// apps/mobile/services/deepLinks.service.ts). If the app does not take over
// within a moment (not installed, or desktop) it falls back to the marketing
// site. The page is identical for every invite; all per-invite logic is client
// side, so it can be cached and needs no server round-trip for invite data.

const MARKETING_SITE = 'https://kupa-pay.com/';
const APP_STORE_URL = 'https://kupa-pay.com/';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.kupapay.mobile';

export function inviteLandingHtml(): string {
    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" />
<title>KupaPay</title>
<style>
  :root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
  body{margin:0;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;}
  .card{background:#fff;color:#0f172a;border-radius:16px;padding:32px;max-width:420px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3);}
  h1{margin:0 0 8px;font-size:28px;font-weight:700;color:#3B82F6;}
  p{margin:0 0 16px;color:#475569;font-size:15px;}
  .btn{display:block;text-decoration:none;padding:14px;border-radius:12px;font-weight:600;margin:8px 0;}
  .btn.primary{background:#0ea5e9;color:#fff;}
  .btn.secondary{background:#f1f5f9;color:#0f172a;}
  .footnote{font-size:12px;color:#94a3b8;margin-top:20px;}
</style>
</head>
<body>
<div class="card">
  <h1>KupaPay</h1>
  <p>פותח את האפליקציה…</p>
  <a class="btn primary" id="open" href="${MARKETING_SITE}">פתח את KupaPay</a>
  <a class="btn secondary" href="${APP_STORE_URL}">🍎 App Store</a>
  <a class="btn secondary" href="${PLAY_STORE_URL}">▶ Google Play</a>
  <p class="footnote">אם האפליקציה לא נפתחת אוטומטית — לחץ "פתח את KupaPay".</p>
</div>
<script>
(function () {
  var marketing = ${JSON.stringify(MARKETING_SITE)};
  var ua = navigator.userAgent || '';
  var isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  var m = location.pathname.match(/[/](i|g|sr)[/]([A-Za-z0-9_-]{10})[/]?$/);
  if (!m) { location.replace(marketing); return; }
  var deeplink = 'com.kupapay.mobile://invite/' + m[1] + '/' + m[2];
  var btn = document.getElementById('open');
  if (btn) { btn.setAttribute('href', deeplink); }
  if (!isMobile) { location.replace(marketing); return; }
  // Fall back to the marketing site only if the app does not take over.
  var t = setTimeout(function () { location.replace(marketing); }, 1600);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimeout(t); }
  });
  window.location.href = deeplink;
})();
</script>
</body>
</html>`;
}
