/** Mirror {@link ../i18n/languages#Language} — inlined for Deno edge bundles. */
type Language = 'en' | 'he' | 'ru' | 'ar' | 'fr' | 'es' | 'de';

export type WeeklyDigestCopy = { subject: string; pushTitle: string; pushBody: string; bodyHtml: string };

type DigestStats = {
    oweTotal: string;
    owedTotal: string;
    topGroupName: string;
};

const fmt = (stats: DigestStats, locale: Language): WeeklyDigestCopy => {
    const group = stats.topGroupName || '—';
    if (locale === 'he') {
        return {
            subject: 'סיכום שבועי ב-KupaPay',
            pushTitle: 'הסיכום השבועי שלך',
            pushBody: `חייבים ${stats.oweTotal} · מגיע לך ${stats.owedTotal} · ${group}`,
            bodyHtml: `<p dir="rtl">השבוע: אתה חייב <strong>${stats.oweTotal}</strong>, מגיע לך <strong>${stats.owedTotal}</strong>. קבוצה מובילה: <strong>${group}</strong>.</p>`,
        };
    }
    if (locale === 'ar') {
        return {
            subject: 'ملخص KupaPay الأسبوعي',
            pushTitle: 'ملخصك الأسبوعي',
            pushBody: `تدين ${stats.oweTotal} · لك ${stats.owedTotal} · ${group}`,
            bodyHtml: `<p dir="rtl">هذا الأسبوع: تدين <strong>${stats.oweTotal}</strong>، ولك <strong>${stats.owedTotal}</strong>. أبرز مجموعة: <strong>${group}</strong>.</p>`,
        };
    }
    return {
        subject: 'Your KupaPay weekly summary',
        pushTitle: 'Your weekly summary',
        pushBody: `You owe ${stats.oweTotal} · You're owed ${stats.owedTotal} · ${group}`,
        bodyHtml: `<p>This week: you owe <strong>${stats.oweTotal}</strong>, you're owed <strong>${stats.owedTotal}</strong>. Top group: <strong>${group}</strong>.</p>`,
    };
};

export function weeklyDigestCopy(locale: Language, stats: DigestStats): WeeklyDigestCopy {
    const allowed: Language[] = ['en', 'he', 'ar', 'de', 'es', 'fr', 'ru'];
    const lang = allowed.includes(locale) ? locale : 'en';
    if (lang === 'de') {
        return {
            ...fmt(stats, 'en'),
            subject: 'Deine KupaPay-Wochenübersicht',
            pushTitle: 'Deine Wochenübersicht',
        };
    }
    if (lang === 'es') {
        return {
            ...fmt(stats, 'en'),
            subject: 'Tu resumen semanal de KupaPay',
            pushTitle: 'Tu resumen semanal',
        };
    }
    if (lang === 'fr') {
        return {
            ...fmt(stats, 'en'),
            subject: 'Votre résumé hebdo KupaPay',
            pushTitle: 'Votre résumé hebdo',
        };
    }
    if (lang === 'ru') {
        return {
            ...fmt(stats, 'en'),
            subject: 'Еженедельная сводка KupaPay',
            pushTitle: 'Ваша недельная сводка',
        };
    }
    return fmt(stats, lang);
}
