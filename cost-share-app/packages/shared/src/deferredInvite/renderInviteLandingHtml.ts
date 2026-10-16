import { APP_WEB_ORIGIN } from '../brand';
import type { Language } from '../i18n/languages';
import { DEFERRED_INVITE_CLIPBOARD_PREFIX } from './constants';
import { inviteLandingCopyFor, inviteLandingDir } from './inviteLandingCopy';
import { parseInvitePathFromPathname, toDeferredInvitePayload } from './parseInvitePath';
import { APP_STORE_LISTING_URL, playStoreListingUrl } from './storeUrls';

export type RenderInviteLandingHtmlOptions = {
    locale: Language;
    /** When omitted, the inline script reads `location.pathname`. */
    pathname?: string;
};

/**
 * Self-contained invite interstitial (Universal Link / App Link fallback).
 * Writes a clipboard token for iOS deferred deep linking and attaches Play Install
 * Referrer on the Play Store URL for Android.
 */
export function renderInviteLandingHtml(options: RenderInviteLandingHtmlOptions): string {
    const copy = inviteLandingCopyFor(options.locale);
    const dir = inviteLandingDir(options.locale);
    const langAttr = options.locale;

    const bootConfig = {
        marketingOrigin: APP_WEB_ORIGIN,
        pathname: options.pathname ?? null,
        clipboardPrefix: DEFERRED_INVITE_CLIPBOARD_PREFIX,
    };

    return `<!DOCTYPE html>
<html lang="${langAttr}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(copy.title)}</title>
<style>
  :root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
  body{margin:0;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}
  .card{background:#fff;color:#0f172a;border-radius:16px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3);}
  h1{margin:0 0 8px;font-size:28px;font-weight:700;color:#3B82F6;}
  p{margin:0 0 16px;color:#475569;font-size:15px;line-height:1.45;}
  .btn{display:block;text-decoration:none;padding:14px;border-radius:12px;font-weight:600;margin:8px 0;box-sizing:border-box;}
  .btn.primary{background:#0ea5e9;color:#fff;}
  .btn.secondary{background:#f1f5f9;color:#0f172a;}
  .btn.ghost{background:transparent;color:#64748b;font-weight:500;}
  .footnote{font-size:12px;color:#94a3b8;margin-top:20px;}
  .hint{font-size:13px;color:#64748b;min-height:1.2em;}
  .store-row{display:flex;flex-direction:column;gap:0;}
  @media (min-width:480px){ .store-row{flex-direction:row;gap:8px;} .store-row .btn{flex:1;margin:0;} }
</style>
</head>
<body>
<div class="card">
  <h1>${escapeHtml(copy.title)}</h1>
  <p id="status">${escapeHtml(copy.opening)}</p>
  <p class="hint" id="hint" hidden>${escapeHtml(copy.installingHint)}</p>
  <a class="btn primary" id="open" href="${APP_WEB_ORIGIN}/">${escapeHtml(copy.openApp)}</a>
  <div class="store-row">
    <a class="btn secondary" id="ios-store" href="${APP_STORE_LISTING_URL}">${escapeHtml(copy.appStore)}</a>
    <a class="btn secondary" id="play-store" href="${playStoreListingUrl()}">${escapeHtml(copy.playStore)}</a>
  </div>
  <a class="btn ghost" id="web-continue" href="${APP_WEB_ORIGIN}/">${escapeHtml(copy.continueWeb)}</a>
  <p class="footnote">${escapeHtml(copy.footnote)}</p>
</div>
<script>
(function () {
  var cfg = ${JSON.stringify(bootConfig)};
  var copy = ${JSON.stringify(copy)};
  var pathname = cfg.pathname || location.pathname;
  var parsed = (function (p) {
    var m = p.match(/^\\/?(i|g|sr)\\/([^/?#]+)\\/?$/);
    if (!m) return null;
    return { pathKind: m[1], token: m[2] };
  })(pathname);
  if (!parsed) {
    location.replace(cfg.marketingOrigin);
    return;
  }
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid;
  var deferred = parsed.pathKind === 'i' || parsed.pathKind === 'g'
    ? { kind: parsed.pathKind === 'i' ? 'friend' : 'group', token: parsed.token }
    : null;
  var universal = cfg.marketingOrigin + '/' + parsed.pathKind + '/' + parsed.token;
  var deeplink = 'com.kupapay.mobile://invite/' + parsed.pathKind + '/' + parsed.token;
  var openBtn = document.getElementById('open');
  var hintEl = document.getElementById('hint');
  var webBtn = document.getElementById('web-continue');
  if (openBtn) openBtn.setAttribute('href', deeplink);
  if (webBtn) webBtn.setAttribute('href', universal);

  function clipboardPayload() {
    if (!deferred) return null;
    return cfg.clipboardPrefix + ':' + deferred.kind + ':' + deferred.token;
  }

  function writeClipboard(payload) {
    if (!payload || !navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve(false);
    return navigator.clipboard.writeText(payload).then(function () { return true; }).catch(function () { return false; });
  }

  function playStoreWithReferrer() {
    var base = 'https://play.google.com/store/apps/details?id=com.kupapay.mobile';
    if (!deferred) return base;
    var ref = 'invite_kind=' + encodeURIComponent(deferred.kind) + '&invite_token=' + encodeURIComponent(deferred.token);
    return base + '&referrer=' + encodeURIComponent(ref);
  }

  var playBtn = document.getElementById('play-store');
  if (playBtn && deferred) playBtn.setAttribute('href', playStoreWithReferrer());

  if (!isMobile) {
    var status = document.getElementById('status');
    if (status) status.textContent = copy.continueWeb;
    return;
  }

  var appOpened = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) appOpened = true;
  });
  window.addEventListener('pagehide', function () { appOpened = true; });

  writeClipboard(clipboardPayload()).then(function () {
    window.location.href = universal;
    setTimeout(function () { window.location.href = deeplink; }, 400);
  });

  setTimeout(function () {
    if (appOpened || document.hidden) return;
    if (hintEl) hintEl.hidden = false;
    if (isIOS) {
      location.href = ${JSON.stringify(APP_STORE_LISTING_URL)};
    } else if (isAndroid) {
      location.href = playStoreWithReferrer();
    }
  }, 2800);
})();
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Server-side helper: validate pathname and build deferred payloads for tests. */
export function inviteLandingContextFromPathname(pathname: string): {
    universalUrl: string;
    deferred: ReturnType<typeof toDeferredInvitePayload>;
} | null {
    const parsed = parseInvitePathFromPathname(pathname);
    if (!parsed) return null;
    const pathKind = parsed.pathKind;
    return {
        universalUrl: `${APP_WEB_ORIGIN}/${pathKind}/${parsed.token}`,
        deferred: toDeferredInvitePayload(parsed),
    };
}
