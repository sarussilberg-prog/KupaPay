import { APP_BRAND_TITLE, APP_WEB_ORIGIN } from '../brand';
import type { Language } from '../i18n/languages';
import { formatMoney } from '../i18n/formatMoney';
import { APP_STORE_LISTING_URL, playStoreListingUrl } from '../deferredInvite/storeUrls';
import { buildPublicGroupViewModel } from './buildPublicGroupViewModel';
import {
    interpolateCopy,
    publicGroupPageCopyFor,
    publicGroupPageDir,
} from './publicGroupPageCopy';
import type { PublicGroupBalancePageWire } from './types';

export type RenderPublicGroupPageHtmlOptions = {
    locale: Language;
    token: string;
    wire: PublicGroupBalancePageWire;
    canonicalPath: string;
};

const OG_IMAGE = `${APP_WEB_ORIGIN}/icon-512.png`;

export function renderPublicGroupNotFoundHtml(locale: Language): string {
    const copy = publicGroupPageCopyFor(locale);
    const dir = publicGroupPageDir(locale);
    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${escapeHtml(APP_BRAND_TITLE)}</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px;text-align:center;">
<p>${escapeHtml(copy.unknownUser)}</p>
<a href="${APP_WEB_ORIGIN}/">${escapeHtml(copy.getApp)}</a>
</body>
</html>`;
}

export function renderPublicGroupPageHtml(options: RenderPublicGroupPageHtmlOptions): string {
    const view = buildPublicGroupViewModel(options.wire, options.locale);
    if (!view) return renderPublicGroupNotFoundHtml(options.locale);

    const copy = publicGroupPageCopyFor(options.locale);
    const dir = publicGroupPageDir(options.locale);
    const canonical = `${APP_WEB_ORIGIN}${options.canonicalPath}`;
    const loginUrl = `${APP_WEB_ORIGIN}/login`;
    const title = `${view.groupName} — ${copy.pageTitle}`;

    const debtSections = view.debtsByCurrency
        .map(rows =>
            rows
                .map(row => {
                    const amount = formatMoney(row.amount, row.currency, {
                        language: options.locale,
                    });
                    const line = interpolateCopy(copy.owes, {
                        from: row.fromName,
                        to: row.toName,
                        amount,
                    });
                    return `<li>${escapeHtml(line)}</li>`;
                })
                .join(''),
        )
        .map(list => `<ul class="debts">${list}</ul>`)
        .join('');

    const debtsBlock =
        debtSections ||
        `<p class="muted">${escapeHtml(copy.allSettled)}</p>`;

    const expenseRows = view.recentExpenses
        .map(
            exp => `<li class="expense">
  <div class="expense-main"><strong>${escapeHtml(exp.description)}</strong>
  <span class="amount">${escapeHtml(exp.amountLabel)}</span></div>
  <div class="expense-meta">${escapeHtml(exp.paidByLabel)} · ${escapeHtml(exp.dateLabel)}</div>
</li>`,
        )
        .join('');

    const expensesBlock =
        expenseRows ||
        `<p class="muted">${escapeHtml(copy.noExpenses)}</p>`;

    return `<!DOCTYPE html>
<html lang="${options.locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(view.ogDescription)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(view.ogDescription)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<style>
  :root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; }
  body { margin: 0; background: #f1f5f9; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px 16px 48px; box-sizing: border-box; }
  header { padding: 8px 0 16px; }
  h1 { margin: 0 0 4px; font-size: 1.75rem; }
  .brand { color: #3B82F6; font-weight: 700; font-size: 0.875rem; letter-spacing: 0.02em; }
  section { background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  h2 { margin: 0 0 12px; font-size: 1.125rem; }
  ul.debts, ul.expenses { list-style: none; margin: 0; padding: 0; }
  ul.debts li { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
  ul.debts li:last-child { border-bottom: none; }
  .expense { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
  .expense:last-child { border-bottom: none; }
  .expense-main { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .amount { font-weight: 600; white-space: nowrap; }
  .expense-meta { font-size: 0.875rem; color: #64748b; margin-top: 4px; }
  .muted { color: #64748b; margin: 0; }
  .cta-row { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .btn { display: block; text-align: center; text-decoration: none; padding: 14px 16px; border-radius: 12px; font-weight: 600; }
  .btn-primary { background: #0ea5e9; color: #fff; }
  .btn-secondary { background: #e2e8f0; color: #0f172a; }
  .stores { display: flex; flex-direction: column; gap: 8px; }
  @media (min-width: 520px) { .stores { flex-direction: row; } .stores .btn { flex: 1; } }
  .hint { font-size: 0.875rem; color: #64748b; margin: 0 0 12px; }
  footer { font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 24px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">${escapeHtml(APP_BRAND_TITLE)}</div>
    <h1>${escapeHtml(view.groupName)}</h1>
  </header>
  <section aria-labelledby="balances-h">
    <h2 id="balances-h">${escapeHtml(copy.balancesHeading)}</h2>
    ${debtsBlock}
  </section>
  <section aria-labelledby="recent-h">
    <h2 id="recent-h">${escapeHtml(copy.recentHeading)}</h2>
    ${expenseRows ? `<ul class="expenses">${expenseRows}</ul>` : expensesBlock}
  </section>
  <section aria-labelledby="cta-h">
    <h2 id="cta-h">${escapeHtml(copy.openApp)}</h2>
    <p class="hint">${escapeHtml(copy.joinHint)}</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="${escapeHtml(loginUrl)}">${escapeHtml(copy.addExpenseWeb)}</a>
      <a class="btn btn-secondary" href="${APP_STORE_LISTING_URL}">${escapeHtml(copy.openApp)}</a>
    </div>
    <div class="stores" style="margin-top:12px;">
      <a class="btn btn-secondary" href="${APP_STORE_LISTING_URL}">${escapeHtml(copy.getApp)} — App Store</a>
      <a class="btn btn-secondary" href="${playStoreListingUrl()}">${escapeHtml(copy.getApp)} — Google Play</a>
    </div>
  </section>
  <footer>${escapeHtml(copy.footnote)}</footer>
</div>
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
