import {
    buildEmailPreferencesUrl,
    buildEmailUnsubscribeUrl,
    isEmailLifecycleTemplateId,
    lifecycleEmailCopy,
    renderTransactionalEmailHtml,
    type Language,
} from '../../../packages/shared/src/index.ts';
import {
    sendTransactionalEmail,
    transactionalEmailEnabled,
} from '../_shared/transactionalEmail.ts';

export interface LifecycleQueueItem {
    user_id: string;
    email: string;
    language: string;
    template: string;
    unsubscribe_token: string;
}

export interface LifecycleDispatchDeps {
    fetchQueue(limit: number): Promise<LifecycleQueueItem[]>;
    markSent(userId: string, template: string): Promise<void>;
}

function normalizeLang(raw: string): Language {
    const base = raw.split('-')[0]?.toLowerCase() ?? 'en';
    const allowed: Language[] = ['en', 'he', 'ar', 'de', 'es', 'fr', 'ru'];
    return (allowed.includes(base as Language) ? base : 'en') as Language;
}

export async function dispatchEmailLifecycle(
    deps: LifecycleDispatchDeps,
    limit = 200,
): Promise<Record<string, unknown>> {
    const items = await deps.fetchQueue(limit);
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (!transactionalEmailEnabled()) {
        return {
            ok: true,
            providerConfigured: false,
            queued: items.length,
            sent: 0,
            skipped: items.length,
            note: 'Set RESEND_API_KEY (Supabase Auth SMTP provider) to send lifecycle email.',
        };
    }

    const webOrigin = Deno.env.get('PUBLIC_WEB_ORIGIN') ?? 'https://kupa-pay.com';

    for (const item of items) {
        if (!isEmailLifecycleTemplateId(item.template)) {
            skipped += 1;
            continue;
        }
        const lang = normalizeLang(item.language);
        const copy = lifecycleEmailCopy(item.template, lang);
        const html = renderTransactionalEmailHtml({
            bodyHtml: copy.bodyHtml,
            unsubscribeUrl: buildEmailUnsubscribeUrl(item.unsubscribe_token, webOrigin),
            preferencesUrl: buildEmailPreferencesUrl(webOrigin),
            footerNote: lang === 'he' || lang === 'ar' ? 'העדפות דוא"ל' : 'Email preferences',
        });

        const result = await sendTransactionalEmail({
            to: item.email,
            subject: copy.subject,
            html,
        });

        if (result.ok) {
            await deps.markSent(item.user_id, item.template);
            sent += 1;
        } else if ('skipped' in result && result.skipped) {
            skipped += 1;
        } else {
            errors.push(`${item.user_id}:${item.template}:${'error' in result ? result.error : 'unknown'}`);
        }
    }

    return {
        ok: true,
        providerConfigured: true,
        queued: items.length,
        sent,
        skipped,
        errors: errors.slice(0, 20),
    };
}
