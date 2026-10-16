import { proTrialValueSummary, type ProTrialFeatureUsage } from '../../../packages/shared/src/pro/proTrialLifecycle.ts';

export interface LifecyclePushItem {
    user_id: string;
    language: string;
    touch_day: number;
    feature_usage: ProTrialFeatureUsage;
}

const COPY: Record<number, { en: { title: string; body: string }; he: { title: string; body: string } }> = {
    1: {
        en: {
            title: 'Your Pro trial is active',
            body: 'Explore receipt scan, recurring bills, and smart reminders during your free trial.',
        },
        he: {
            title: 'ניסיון Pro פעיל',
            body: 'גלו סריקת קבלות, הוצאות חוזרות ותזכורות חכמות בחינם.',
        },
    },
    10: {
        en: {
            title: '4 days left on Pro',
            body: 'You can cancel anytime in Settings before the trial renews.',
        },
        he: {
            title: 'נשארו 4 ימים ב-Pro',
            body: 'אפשר לבטל בכל עת בהגדרות לפני החידוש.',
        },
    },
    13: {
        en: {
            title: 'Pro renews tomorrow',
            body: 'Manage or cancel your subscription in Settings. No charge if you cancel before renewal.',
        },
        he: {
            title: 'Pro מתחדש מחר',
            body: 'נהלו או בטלו את המנוי בהגדרות. בלי חיוב אם מבטלים לפני החידוש.',
        },
    },
};

export async function dispatchProTrialLifecycle(
    deps: {
        fetchItems(): Promise<LifecyclePushItem[]>;
        loadTokens(userId: string): Promise<Array<{ token: string }>>;
        markSent(userId: string, day: number): Promise<void>;
        sendExpo(messages: Array<{
            to: string;
            title: string;
            body: string;
            data: Record<string, unknown>;
            sound: 'default';
        }>): Promise<void>;
    },
): Promise<{ sent: number; skipped: number }> {
    const items = await deps.fetchItems();
    let sent = 0;
    let skipped = 0;

    for (const item of items) {
        const tokens = await deps.loadTokens(item.user_id);
        if (tokens.length === 0) {
            skipped += 1;
            continue;
        }
        const lang = item.language === 'he' ? 'he' : 'en';
        const base = COPY[item.touch_day]?.[lang] ?? COPY[1].en;
        const usageLine = proTrialValueSummary(item.feature_usage ?? {}, item.language);
        const body = `${base.body} ${usageLine}`.trim();
        await deps.sendExpo(tokens.map(t => ({
            to: t.token,
            title: base.title,
            body,
            data: { kind: 'pro_trial_lifecycle', touchDay: item.touch_day },
            sound: 'default' as const,
        })));
        await deps.markSent(item.user_id, item.touch_day);
        sent += 1;
    }

    return { sent, skipped };
}
