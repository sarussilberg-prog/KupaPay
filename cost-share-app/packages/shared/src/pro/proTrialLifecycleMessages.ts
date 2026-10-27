import { normalizePushLocale, type PushLocale } from '../notifications/pushPolicy';
import type { ProTrialFeatureUsage, ProTrialLifecycleTouchDay } from './proTrialLifecycle';

type DayCopy = { title: string; body: string };

const DAY_COPY: Record<ProTrialLifecycleTouchDay, Record<PushLocale, DayCopy>> = {
    1: {
        en: {
            title: 'Your Pro trial is active',
            body: 'Explore receipt scan, recurring bills, and smart reminders during your free trial.',
        },
        he: {
            title: 'ניסיון Pro פעיל',
            body: 'גלו סריקת קבלות, הוצאות חוזרות ותזכורות חכמות בחינם.',
        },
        ar: {
            title: 'تجربة Pro نشطة',
            body: 'جرّب مسح الإيصالات والفواتير المتكررة والتذكيرات الذكية مجانًا.',
        },
        de: {
            title: 'Ihre Pro-Testphase läuft',
            body: 'Testen Sie Belegscan, wiederkehrende Ausgaben und smarte Erinnerungen.',
        },
        es: {
            title: 'Tu prueba Pro está activa',
            body: 'Prueba escaneo de recibos, gastos recurrentes y recordatorios inteligentes.',
        },
        fr: {
            title: 'Votre essai Pro est actif',
            body: 'Essayez scan de reçus, dépenses récurrentes et rappels intelligents.',
        },
        ru: {
            title: 'Пробный Pro активен',
            body: 'Попробуйте скан чеков, повторяющиеся расходы и умные напоминания.',
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
        ar: {
            title: '4 أيام متبقية في Pro',
            body: 'يمكنك الإلغاء في أي وقت من الإعدادات قبل التجديد.',
        },
        de: {
            title: 'Noch 4 Tage Pro',
            body: 'Kündigen Sie jederzeit in den Einstellungen vor der Verlängerung.',
        },
        es: {
            title: 'Quedan 4 días de Pro',
            body: 'Cancela cuando quieras en Ajustes antes de la renovación.',
        },
        fr: {
            title: '4 jours restants sur Pro',
            body: 'Annulez à tout moment dans Réglages avant le renouvellement.',
        },
        ru: {
            title: 'Осталось 4 дня Pro',
            body: 'Отмените в настройках в любой момент до продления.',
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
        ar: {
            title: 'Pro يتجدد غدًا',
            body: 'أدر أو ألغِ الاشتراك من الإعدادات. بدون رسوم إذا ألغيت قبل التجديد.',
        },
        de: {
            title: 'Pro verlängert sich morgen',
            body: 'Verwalten oder kündigen Sie in den Einstellungen. Keine Gebühr bei Kündigung vorher.',
        },
        es: {
            title: 'Pro se renueva mañana',
            body: 'Gestiona o cancela en Ajustes. Sin cargo si cancelas antes.',
        },
        fr: {
            title: 'Pro se renouvelle demain',
            body: 'Gérez ou annulez dans Réglages. Pas de frais si vous annulez avant.',
        },
        ru: {
            title: 'Pro продлится завтра',
            body: 'Управляйте или отмените в настройках. Без списания при отмене заранее.',
        },
    },
};

const FEATURE_LABELS: Record<keyof Required<ProTrialFeatureUsage>, Record<PushLocale, string>> = {
    receiptScan: {
        en: 'receipt scan', he: 'סריקת קבלות', ar: 'مسح الإيصالات', de: 'Belegscan',
        es: 'escaneo de recibos', fr: 'scan de reçus', ru: 'скан чеков',
    },
    recurring: {
        en: 'recurring expenses', he: 'הוצאות חוזרות', ar: 'مصاريف متكررة', de: 'wiederkehrende Ausgaben',
        es: 'gastos recurrentes', fr: 'dépenses récurrentes', ru: 'повторяющиеся расходы',
    },
    smartReminder: {
        en: 'smart reminders', he: 'תזכורות חכמות', ar: 'تذكيرات ذكية', de: 'smarte Erinnerungen',
        es: 'recordatorios inteligentes', fr: 'rappels intelligents', ru: 'умные напоминания',
    },
    tripBudget: {
        en: 'trip budget', he: 'תקציב טיול', ar: 'ميزانية الرحلة', de: 'Reisebudget',
        es: 'presupuesto del viaje', fr: 'budget voyage', ru: 'бюджет поездки',
    },
    spendingInsights: {
        en: 'spending insights', he: 'תובנות הוצאה', ar: 'رؤى الإنفاق', de: 'Ausgaben-Einblicke',
        es: 'información de gastos', fr: 'analyses de dépenses', ru: 'аналитика расходов',
    },
};

const USAGE_NONE: Record<PushLocale, string> = {
    en: 'Try receipt scan, recurring expenses, and smart reminders.',
    he: 'נסו סריקת קבלות, הוצאות חוזרות ותזכורות חכמות.',
    ar: 'جرّب مسح الإيصالات والمصاريف المتكررة والتذكيرات الذكية.',
    de: 'Testen Sie Belegscan, wiederkehrende Ausgaben und smarte Erinnerungen.',
    es: 'Prueba escaneo de recibos, gastos recurrentes y recordatorios.',
    fr: 'Essayez scan de reçus, dépenses récurrentes et rappels.',
    ru: 'Попробуйте скан чеков, повторяющиеся расходы и напоминания.',
};

const USAGE_PREFIX: Record<PushLocale, string> = {
    en: "You've used: {features}.",
    he: 'כבר השתמשתם ב: {features}.',
    ar: 'استخدمت: {features}.',
    de: 'Sie nutzten bereits: {features}.',
    es: 'Ya usaste: {features}.',
    fr: 'Vous avez utilisé : {features}.',
    ru: 'Вы уже использовали: {features}.',
};

export function proTrialFeatureUsageLine(usage: ProTrialFeatureUsage, localeCode: string): string {
    const locale = normalizePushLocale(localeCode);
    const labels: string[] = [];
    if (usage.receiptScan) labels.push(FEATURE_LABELS.receiptScan[locale]);
    if (usage.recurring) labels.push(FEATURE_LABELS.recurring[locale]);
    if (usage.smartReminder) labels.push(FEATURE_LABELS.smartReminder[locale]);
    if (usage.tripBudget) labels.push(FEATURE_LABELS.tripBudget[locale]);
    if (usage.spendingInsights) labels.push(FEATURE_LABELS.spendingInsights[locale]);
    if (labels.length === 0) return USAGE_NONE[locale];
    return USAGE_PREFIX[locale].replace('{features}', labels.join(', '));
}

export function renderProTrialLifecyclePush(
    touchDay: ProTrialLifecycleTouchDay,
    usage: ProTrialFeatureUsage,
    localeCode: string,
): { title: string; body: string } {
    const locale = normalizePushLocale(localeCode);
    const base = DAY_COPY[touchDay][locale];
    const usageLine = proTrialFeatureUsageLine(usage, localeCode);
    return { title: base.title, body: `${base.body} ${usageLine}`.trim() };
}
