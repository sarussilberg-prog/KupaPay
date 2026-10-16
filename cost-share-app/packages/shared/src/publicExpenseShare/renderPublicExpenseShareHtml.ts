import { APP_BRAND_TITLE, APP_WEB_ORIGIN } from '../brand';
import type { Language } from '../i18n/languages';
import { formatMoney } from '../i18n/formatMoney';
import { APP_STORE_LISTING_URL, playStoreListingUrl } from '../deferredInvite/storeUrls';
import {
    expenseShareCopyFor,
    expenseShareDir,
    interpolateExpenseShare,
} from './expenseShareCopy';
import type { PublicExpenseShareWire } from './types';

const OG_IMAGE = `${APP_WEB_ORIGIN}/icon-512.png`;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function renderPublicExpenseShareNotFoundHtml(locale: Language): string {
    const copy = expenseShareCopyFor(locale);
    const dir = expenseShareDir(locale);
    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="robots" content="noindex,nofollow"/>
<title>${escapeHtml(APP_BRAND_TITLE)}</title></head>
<body style="font-family:system-ui;padding:24px;text-align:center">
<a href="${APP_WEB_ORIGIN}/">${escapeHtml(copy.getApp)}</a>
</body></html>`;
}

export type RenderPublicExpenseShareHtmlOptions = {
    locale: Language;
    token: string;
    wire: PublicExpenseShareWire;
    canonicalPath: string;
};

export function renderPublicExpenseShareHtml(options: RenderPublicExpenseShareHtmlOptions): string {
    const { wire, locale, token, canonicalPath } = options;
    if (
        !wire.ok ||
        wire.description == null ||
        wire.amount == null ||
        !wire.currency
    ) {
        return renderPublicExpenseShareNotFoundHtml(locale);
    }

    const copy = expenseShareCopyFor(locale);
    const dir = expenseShareDir(locale);
    const amountLabel = formatMoney(wire.amount, wire.currency, { language: locale });
    const title = wire.description;
    const groupName = wire.group_name ?? '';
    const ogDescription = interpolateExpenseShare(copy.ogLine, {
        amount: amountLabel,
        description: wire.description,
        group: groupName,
    });
    const canonical = `${APP_WEB_ORIGIN}${canonicalPath}`;
    const deepLink = `com.kupapay.mobile://invite/e/${token}`;

    const paidBy = interpolateExpenseShare(copy.paidBy, {
        name: wire.payer_name ?? '—',
    });
    const groupLine = groupName
        ? interpolateExpenseShare(copy.groupLabel, { name: groupName })
        : '';

    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${escapeHtml(title)} — ${escapeHtml(copy.pageTitle)}</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(ogDescription)}"/>
<meta property="og:url" content="${escapeHtml(canonical)}"/>
<meta property="og:image" content="${OG_IMAGE}"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="canonical" href="${escapeHtml(canonical)}"/>
</head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h1 style="font-size:1.25rem">${escapeHtml(title)}</h1>
<p style="font-size:1.5rem;font-weight:700">${escapeHtml(amountLabel)}</p>
<p>${escapeHtml(paidBy)}</p>
${groupLine ? `<p class="muted">${escapeHtml(groupLine)}</p>` : ''}
<p style="margin-top:24px">
<a href="${escapeHtml(deepLink)}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;border-radius:12px;text-decoration:none">${escapeHtml(copy.getApp)}</a>
</p>
<p style="margin-top:12px;font-size:0.875rem">
<a href="${APP_STORE_LISTING_URL}">App Store</a> · <a href="${playStoreListingUrl()}">Google Play</a>
</p>
</body>
</html>`;
}
