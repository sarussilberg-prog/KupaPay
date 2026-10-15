/**
 * Daily cron fallback: push users whose Pro trial ends in ~2 days (local notification backup).
 */

export interface TrialReminderRow {
    id: string;
    language: string | null;
}

export interface DispatchDeps {
    listDueReminders(now: Date): Promise<TrialReminderRow[]>;
    loadActiveTokens(userId: string): Promise<Array<{ token: string }>>;
    markReminderSent(userId: string): Promise<void>;
    sendExpo(messages: Array<{
        to: string;
        title: string;
        body: string;
        data: Record<string, unknown>;
        sound: 'default';
    }>): Promise<void>;
}

const COPY = {
    en: {
        title: 'KupaPay Pro trial ending soon',
        body: "Your free KupaPay Pro trial ends in two days. Don't want to continue? You can cancel in Settings.",
    },
    he: {
        title: 'ניסיון KupaPay Pro מסתיים בקרוב',
        body: 'הניסיון החינמי שלך ב-KupaPay Pro מסתיים בעוד יומיים. לא רוצה להמשיך? אפשר לבטל בהגדרות.',
    },
} as const;

export async function dispatchProTrialReminders(
    deps: DispatchDeps,
    now = new Date(),
): Promise<{ sent: number; skipped: number }> {
    const due = await deps.listDueReminders(now);
    let sent = 0;
    let skipped = 0;

    for (const row of due) {
        const tokens = await deps.loadActiveTokens(row.id);
        if (tokens.length === 0) {
            skipped += 1;
            continue;
        }
        const lang = row.language === 'he' ? 'he' : 'en';
        const copy = COPY[lang];
        await deps.sendExpo(
            tokens.map(t => ({
                to: t.token,
                title: copy.title,
                body: copy.body,
                data: { kind: 'pro_trial_reminder' },
                sound: 'default' as const,
            })),
        );
        await deps.markReminderSent(row.id);
        sent += 1;
    }

    return { sent, skipped };
}
