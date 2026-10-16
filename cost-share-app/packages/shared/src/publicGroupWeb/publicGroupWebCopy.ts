import { isRtlLanguage, type Language } from '../i18n/languages';

export type PublicGroupWebCopy = {
    pageTitle: string;
    balancesHeading: string;
    debtsHeading: string;
    expensesHeading: string;
    settledUp: string;
    owes: string;
    owed: string;
    addExpenseWeb: string;
    getApp: string;
    openApp: string;
    appStore: string;
    playStore: string;
    privacyNote: string;
    memberCount: (n: number) => string;
    debtLine: (from: string, to: string, amount: string) => string;
    expenseLine: (description: string, paidBy: string) => string;
};

const COPY: Record<Language, PublicGroupWebCopy> = {
    en: {
        pageTitle: 'Group balances',
        balancesHeading: 'Balances',
        debtsHeading: 'Who owes whom',
        expensesHeading: 'Recent expenses',
        settledUp: 'settled up',
        owes: 'owes',
        owed: 'gets back',
        addExpenseWeb: 'Add an expense on the web',
        getApp: 'Get the KupaPay app',
        openApp: 'Open in the app',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'Only people with this link can view these balances.',
        memberCount: (n) => (n === 1 ? '1 member' : `${n} members`),
        debtLine: (from, to, amount) => `${from} owes ${to} ${amount}`,
        expenseLine: (description, paidBy) => `${description} · paid by ${paidBy}`,
    },
    he: {
        pageTitle: 'יתרות הקופה',
        balancesHeading: 'יתרות',
        debtsHeading: 'מי חייב למי',
        expensesHeading: 'הוצאות אחרונות',
        settledUp: 'מסולק',
        owes: 'חייב',
        owed: 'מגיע לו',
        addExpenseWeb: 'הוספת הוצאה בדפדפן',
        getApp: 'הורידו את KupaPay',
        openApp: 'פתיחה באפליקציה',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'רק מי שיש לו את הקישור הזה יכול לראות את היתרות.',
        memberCount: (n) => (n === 1 ? 'חבר אחד' : `${n} חברים`),
        debtLine: (from, to, amount) => `${from} חייב ל${to} ${amount}`,
        expenseLine: (description, paidBy) => `${description} · שילם ${paidBy}`,
    },
    ar: {
        pageTitle: 'أرصدة المجموعة',
        balancesHeading: 'الأرصدة',
        debtsHeading: 'من يدين لمن',
        expensesHeading: 'المصروفات الأخيرة',
        settledUp: 'مسوّى',
        owes: 'يدين',
        owed: 'يستحق',
        addExpenseWeb: 'إضافة مصروف على الويب',
        getApp: 'حمّل تطبيق KupaPay',
        openApp: 'فتح في التطبيق',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'فقط من لديه هذا الرابط يمكنه عرض الأرصدة.',
        memberCount: (n) => (n === 1 ? 'عضو واحد' : `${n} أعضاء`),
        debtLine: (from, to, amount) => `${from} يدين لـ ${to} ${amount}`,
        expenseLine: (description, paidBy) => `${description} · دفع ${paidBy}`,
    },
    de: {
        pageTitle: 'Gruppensalden',
        balancesHeading: 'Salden',
        debtsHeading: 'Wer schuldet wem',
        expensesHeading: 'Letzte Ausgaben',
        settledUp: 'ausgeglichen',
        owes: 'schuldet',
        owed: 'bekommt',
        addExpenseWeb: 'Ausgabe im Web hinzufügen',
        getApp: 'KupaPay-App holen',
        openApp: 'In der App öffnen',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'Nur wer diesen Link hat, kann die Salden sehen.',
        memberCount: (n) => (n === 1 ? '1 Mitglied' : `${n} Mitglieder`),
        debtLine: (from, to, amount) => `${from} schuldet ${to} ${amount}`,
        expenseLine: (description, paidBy) => `${description} · bezahlt von ${paidBy}`,
    },
    es: {
        pageTitle: 'Saldos del grupo',
        balancesHeading: 'Saldos',
        debtsHeading: 'Quién debe a quién',
        expensesHeading: 'Gastos recientes',
        settledUp: 'saldo cero',
        owes: 'debe',
        owed: 'le deben',
        addExpenseWeb: 'Añadir un gasto en la web',
        getApp: 'Descargar KupaPay',
        openApp: 'Abrir en la app',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'Solo quien tenga este enlace puede ver los saldos.',
        memberCount: (n) => (n === 1 ? '1 miembro' : `${n} miembros`),
        debtLine: (from, to, amount) => `${from} debe a ${to} ${amount}`,
        expenseLine: (description, paidBy) => `${description} · pagó ${paidBy}`,
    },
    fr: {
        pageTitle: 'Soldes du groupe',
        balancesHeading: 'Soldes',
        debtsHeading: 'Qui doit à qui',
        expensesHeading: 'Dépenses récentes',
        settledUp: 'équilibré',
        owes: 'doit',
        owed: 'à recevoir',
        addExpenseWeb: 'Ajouter une dépense sur le web',
        getApp: 'Télécharger KupaPay',
        openApp: 'Ouvrir dans l’app',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'Seules les personnes avec ce lien peuvent voir les soldes.',
        memberCount: (n) => (n === 1 ? '1 membre' : `${n} membres`),
        debtLine: (from, to, amount) => `${from} doit ${amount} à ${to}`,
        expenseLine: (description, paidBy) => `${description} · payé par ${paidBy}`,
    },
    ru: {
        pageTitle: 'Балансы группы',
        balancesHeading: 'Балансы',
        debtsHeading: 'Кто кому должен',
        expensesHeading: 'Недавние расходы',
        settledUp: 'без долга',
        owes: 'должен',
        owed: 'ему должны',
        addExpenseWeb: 'Добавить расход в вебе',
        getApp: 'Скачать KupaPay',
        openApp: 'Открыть в приложении',
        appStore: 'App Store',
        playStore: 'Google Play',
        privacyNote: 'Балансы видны только по этой ссылке.',
        memberCount: (n) => {
            const mod10 = n % 10;
            const mod100 = n % 100;
            if (mod10 === 1 && mod100 !== 11) return `${n} участник`;
            if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} участника`;
            return `${n} участников`;
        },
        debtLine: (from, to, amount) => `${from} должен ${to} ${amount}`,
        expenseLine: (description, paidBy) => `${description} · оплатил ${paidBy}`,
    },
};

export function publicGroupWebCopyFor(locale: Language): PublicGroupWebCopy {
    return COPY[locale] ?? COPY.en;
}

export function publicGroupWebDir(locale: Language): 'rtl' | 'ltr' {
    return isRtlLanguage(locale) ? 'rtl' : 'ltr';
}
