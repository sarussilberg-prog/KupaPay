import { APP_WEB_ORIGIN } from '../brand';
import { DEFERRED_INVITE_CLIPBOARD_PREFIX } from '../deferredInvite/constants';
import { APP_STORE_LISTING_URL, playStoreListingUrl } from '../deferredInvite/storeUrls';
import { formatMoney } from '../i18n/formatMoney';
import type { Language } from '../i18n/languages';
import { publicGroupWebCopyFor, publicGroupWebDir } from './publicGroupWebCopy';
import type { PublicGroupWebViewPayload } from './types';

export type RenderPublicGroupWebHtmlOptions = {
    locale: Language;
    token: string;
    payload: Extract<PublicGroupWebViewPayload, { kind: 'ok' }>;
};

const OG_IMAGE = `${APP_WEB_ORIGIN}/icon-512.png`;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatSignedMoney(amount: number, currency: string, locale: Language): string {
    const abs = formatMoney(Math.abs(amount), currency, { language: locale, bidiIsolate: false });
    if (Math.abs(amount) < 0.01) return abs;
    return amount >= 0 ? `+${abs}` : `−${abs}`;
}

export function renderPublicGroupWebHtml(options: RenderPublicGroupWebHtmlOptions): string {
    const { locale, token, payload } = options;
    const copy = publicGroupWebCopyFor(locale);
    const dir = publicGroupWebDir(locale);
    const groupName = payload.group.name;
    const pageTitle = `${groupName} · ${copy.pageTitle}`;
    const canonical = `${APP_WEB_ORIGIN}/g/${token}`;
    const ogDescription = `${copy.memberCount(payload.members.length)} · ${payload.group.currency}`;

    const balanceRows = payload.balances
        .map((row) => {
            const label =
                Math.abs(row.net) < 0.01
                    ? copy.settledUp
                    : row.net < 0
                      ? copy.owes
                      : copy.owed;
            return `<li class="row">
  <span class="name">${escapeHtml(row.displayName)}</span>
  <span class="amount ${row.net < 0 ? 'neg' : row.net > 0 ? 'pos' : ''}">${escapeHtml(formatSignedMoney(row.net, row.currency, locale))}</span>
  <span class="hint">${escapeHtml(label)}</span>
</li>`;
        })
        .join('');

    const debtRows = payload.debts
        .map((d) => {
            const amount = formatMoney(d.amount, d.currency, { language: locale, bidiIsolate: false });
            return `<li class="row compact">${escapeHtml(copy.debtLine(d.fromName, d.toName, amount))}</li>`;
        })
        .join('');

    const expenseRows = payload.recentExpenses
        .map((e) => {
            const amount = formatMoney(e.amount, e.currency, { language: locale, bidiIsolate: false });
            return `<li class="row compact">
  <span class="expense-main">${escapeHtml(copy.expenseLine(e.description, e.paidByName))}</span>
  <span class="amount">${escapeHtml(amount)}</span>
</li>`;
        })
        .join('');

    const loginUrl = `${APP_WEB_ORIGIN}/login`;
    const deeplink = `com.kupapay.mobile://invite/g/${token}`;

    const bootConfig = {
        marketingOrigin: APP_WEB_ORIGIN,
        pathname: `/g/${token}`,
        clipboardPrefix: DEFERRED_INVITE_CLIPBOARD_PREFIX,
    };

    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(ogDescription)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(pageTitle)}" />
<meta property="og:description" content="${escapeHtml(ogDescription)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary" />
<style>
  :root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;}
  body{margin:0;background:#f1f5f9;color:#0f172a;}
  .wrap{max-width:640px;margin:0 auto;padding:16px 16px 32px;}
  .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(15,23,42,.08);}
  h1{margin:0 0 4px;font-size:22px;font-weight:700;}
  .meta{color:#64748b;font-size:14px;margin-bottom:12px;}
  h2{margin:0 0 12px;font-size:16px;font-weight:600;color:#334155;}
  ul{list-style:none;margin:0;padding:0;}
  .row{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;padding:10px 0;border-bottom:1px solid #f1f5f9;}
  .row:last-child{border-bottom:none;}
  .row.compact{font-size:14px;color:#475569;}
  .name{flex:1;font-weight:600;}
  .amount{font-variant-numeric:tabular-nums;font-weight:600;}
  .amount.pos{color:#059669;}
  .amount.neg{color:#dc2626;}
  .hint{font-size:12px;color:#94a3b8;width:100%;}
  .expense-main{flex:1;}
  .cta{display:flex;flex-direction:column;gap:8px;margin-top:8px;}
  .btn{display:block;text-align:center;text-decoration:none;padding:14px;border-radius:12px;font-weight:600;}
  .btn.primary{background:#0ea5e9;color:#fff;}
  .btn.secondary{background:#e2e8f0;color:#0f172a;}
  .store-row{display:flex;flex-direction:column;gap:8px;}
  @media (min-width:480px){ .store-row{flex-direction:row;} .store-row .btn{flex:1;} }
  .footnote{font-size:12px;color:#94a3b8;margin-top:12px;line-height:1.4;}
  .brand{color:#3b82f6;font-weight:700;}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>${escapeHtml(groupName)}</h1>
    <p class="meta">${escapeHtml(copy.memberCount(payload.members.length))} · ${escapeHtml(payload.group.currency)}</p>
    <div class="cta">
      <a class="btn primary" id="add-expense" href="${escapeHtml(loginUrl)}">${escapeHtml(copy.addExpenseWeb)}</a>
      <a class="btn secondary" id="open-app" href="${escapeHtml(deeplink)}">${escapeHtml(copy.openApp)}</a>
    </div>
    <p class="footnote">${escapeHtml(copy.privacyNote)}</p>
  </div>
  ${
      balanceRows
          ? `<div class="card"><h2>${escapeHtml(copy.balancesHeading)}</h2><ul>${balanceRows}</ul></div>`
          : ''
  }
  ${
      debtRows
          ? `<div class="card"><h2>${escapeHtml(copy.debtsHeading)}</h2><ul>${debtRows}</ul></div>`
          : ''
  }
  ${
      expenseRows
          ? `<div class="card"><h2>${escapeHtml(copy.expensesHeading)}</h2><ul>${expenseRows}</ul></div>`
          : ''
  }
  <div class="card">
    <h2><span class="brand">KupaPay</span> · ${escapeHtml(copy.getApp)}</h2>
    <div class="store-row">
      <a class="btn secondary" id="ios-store" href="${APP_STORE_LISTING_URL}">${escapeHtml(copy.appStore)}</a>
      <a class="btn secondary" id="play-store" href="${playStoreListingUrl()}">${escapeHtml(copy.playStore)}</a>
    </div>
  </div>
</div>
<script>
(function () {
  var cfg = ${JSON.stringify(bootConfig)};
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid;
  var token = ${JSON.stringify(token)};
  var deeplink = 'com.kupapay.mobile://invite/g/' + token;
  var openBtn = document.getElementById('open-app');
  if (openBtn) openBtn.setAttribute('href', deeplink);

  function playStoreWithReferrer() {
    var base = 'https://play.google.com/store/apps/details?id=com.kupapay.mobile';
    var ref = 'invite_kind=group&invite_token=' + token;
    return base + '&referrer=' + encodeURIComponent(ref);
  }
  var playBtn = document.getElementById('play-store');
  if (playBtn) playBtn.setAttribute('href', playStoreWithReferrer());

  if (!isMobile) return;

  var payload = cfg.clipboardPrefix + ':group:' + token;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).catch(function () {});
  }
  setTimeout(function () {
    window.location.href = deeplink;
  }, 350);
})();
</script>
</body>
</html>`;
}
