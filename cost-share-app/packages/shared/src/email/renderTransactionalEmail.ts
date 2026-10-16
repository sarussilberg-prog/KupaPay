/** Default origin — keep in sync with {@link ../brand#APP_WEB_ORIGIN}. */
const DEFAULT_WEB_ORIGIN = 'https://kupa-pay.com';

export function renderTransactionalEmailHtml(input: {
    bodyHtml: string;
    unsubscribeUrl: string;
    preferencesUrl: string;
    footerNote: string;
}): string {
    const { bodyHtml, unsubscribeUrl, preferencesUrl, footerNote } = input;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
${bodyHtml}
<p style="margin-top:32px;font-size:12px;color:#6b7280;">
<a href="${preferencesUrl}">${footerNote}</a>
 · <a href="${unsubscribeUrl}">Unsubscribe</a>
</p>
</body>
</html>`;
}

export function buildEmailUnsubscribeUrl(token: string, webOrigin = DEFAULT_WEB_ORIGIN): string {
    const base = webOrigin.replace(/\/$/, '');
    return `${base}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildEmailPreferencesUrl(webOrigin = DEFAULT_WEB_ORIGIN): string {
    const base = webOrigin.replace(/\/$/, '');
    return `${base}/settings/notifications`;
}
