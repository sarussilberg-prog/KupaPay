import { weeklyDigestCopy } from '../../../packages/shared/src/email/weeklyDigestCopy.ts';
import {
    buildEmailPreferencesUrl,
    buildEmailUnsubscribeUrl,
    renderTransactionalEmailHtml,
} from '../../../packages/shared/src/email/renderTransactionalEmail.ts';
import type { Language } from '../../../packages/shared/src/i18n/languages.ts';
import { sendTransactionalEmail, transactionalEmailEnabled } from '../_shared/transactionalEmail.ts';

export interface WeeklyDigestItem {
    user_id: string;
    email: string | null;
    language: string;
    unsubscribe_token: string;
    send_push: boolean;
    send_email: boolean;
    stats: { total_owe: number; total_owed: number; top_group_name: string };
}

export interface WeeklySummaryDeps {
    fetchBatch(): Promise<{ week_start: string; items: WeeklyDigestItem[] }>;
    loadActiveTokens(userId: string): Promise<Array<{ token: string }>>;
    markSent(userId: string, weekStart: string): Promise<void>;
    sendExpo(messages: Array<{
        to: string;
        title: string;
        body: string;
        data: Record<string, unknown>;
        sound: 'default';
    }>): Promise<void>;
}

function normalizeLang(raw: string): Language {
    const base = raw.split('-')[0]?.toLowerCase() ?? 'en';
    const allowed: Language[] = ['en', 'he', 'ar', 'de', 'es', 'fr', 'ru'];
    return (allowed.includes(base as Language) ? base : 'en') as Language;
}

function moneyLabel(amount: number): string {
    return `$${Number(amount).toFixed(2)}`;
}

export async function dispatchWeeklySummary(deps: WeeklySummaryDeps): Promise<Record<string, unknown>> {
    const batch = await deps.fetchBatch();
    let pushSent = 0;
    let emailSent = 0;
    const webOrigin = Deno.env.get('PUBLIC_WEB_ORIGIN') ?? 'https://kupa-pay.com';

    for (const item of batch.items) {
        const lang = normalizeLang(item.language);
        const copy = weeklyDigestCopy(lang, {
            oweTotal: moneyLabel(item.stats.total_owe ?? 0),
            owedTotal: moneyLabel(item.stats.total_owed ?? 0),
            topGroupName: item.stats.top_group_name ?? '',
        });

        if (item.send_push) {
            const tokens = await deps.loadActiveTokens(item.user_id);
            if (tokens.length > 0) {
                await deps.sendExpo(tokens.map(t => ({
                    to: t.token,
                    title: copy.pushTitle,
                    body: copy.pushBody,
                    data: { kind: 'weekly_summary' },
                    sound: 'default' as const,
                })));
                pushSent += 1;
            }
        }

        if (item.send_email && item.email && transactionalEmailEnabled()) {
            const html = renderTransactionalEmailHtml({
                bodyHtml: copy.bodyHtml,
                unsubscribeUrl: buildEmailUnsubscribeUrl(item.unsubscribe_token, webOrigin),
                preferencesUrl: buildEmailPreferencesUrl(webOrigin),
                footerNote: 'Email preferences',
            });
            const result = await sendTransactionalEmail({
                to: item.email,
                subject: copy.subject,
                html,
            });
            if (result.ok) emailSent += 1;
        }

        await deps.markSent(item.user_id, batch.week_start);
    }

    return {
        ok: true,
        week_start: batch.week_start,
        recipients: batch.items.length,
        pushSent,
        emailSent,
        emailProviderConfigured: transactionalEmailEnabled(),
    };
}
