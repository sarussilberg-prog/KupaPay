import type { Language } from '../i18n/languages';

type Copy = {
    pageTitle: string;
    paidBy: string;
    groupLabel: string;
    getApp: string;
    ogLine: string;
};

const EN: Copy = {
    pageTitle: 'Shared expense',
    paidBy: 'Paid by {{name}}',
    groupLabel: 'Group: {{name}}',
    getApp: 'Get KupaPay',
    ogLine: '{{amount}} — {{description}} ({{group}})',
};

const COPY: Record<Language, Copy> = {
    en: EN,
    he: {
        pageTitle: 'הוצאה משותפת',
        paidBy: 'שילם/ה {{name}}',
        groupLabel: 'קופה: {{name}}',
        getApp: 'הורידו את KupaPay',
        ogLine: '{{amount}} — {{description}} ({{group}})',
    },
    ar: {
        pageTitle: 'مصروف مشترك',
        paidBy: 'دفع {{name}}',
        groupLabel: 'المجموعة: {{name}}',
        getApp: 'حمّل KupaPay',
        ogLine: '{{amount}} — {{description}} ({{group}})',
    },
    de: {
        pageTitle: 'Geteilte Ausgabe',
        paidBy: 'Bezahlt von {{name}}',
        groupLabel: 'Gruppe: {{name}}',
        getApp: 'KupaPay holen',
        ogLine: '{{amount}} — {{description}} ({{group}})',
    },
    es: {
        pageTitle: 'Gasto compartido',
        paidBy: 'Pagó {{name}}',
        groupLabel: 'Grupo: {{name}}',
        getApp: 'Descargar KupaPay',
        ogLine: '{{amount}} — {{description}} ({{group}})',
    },
    fr: {
        pageTitle: 'Dépense partagée',
        paidBy: 'Payé par {{name}}',
        groupLabel: 'Groupe : {{name}}',
        getApp: 'Télécharger KupaPay',
        ogLine: '{{amount}} — {{description}} ({{group}})',
    },
    ru: {
        pageTitle: 'Общий расход',
        paidBy: 'Оплатил(а) {{name}}',
        groupLabel: 'Группа: {{name}}',
        getApp: 'Скачать KupaPay',
        ogLine: '{{amount}} — {{description}} ({{group}})',
    },
};

export function expenseShareCopyFor(locale: Language): Copy {
    return COPY[locale] ?? EN;
}

export function expenseShareDir(locale: Language): 'ltr' | 'rtl' {
    return locale === 'he' || locale === 'ar' ? 'rtl' : 'ltr';
}

export function interpolateExpenseShare(
    template: string,
    vars: Record<string, string>,
): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}
