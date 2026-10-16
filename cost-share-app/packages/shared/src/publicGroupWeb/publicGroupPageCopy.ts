import { isRtlLanguage, type Language } from '../i18n/languages';

export type PublicGroupPageCopy = {
    pageTitle: string;
    balancesHeading: string;
    recentHeading: string;
    allSettled: string;
    owes: string;
    paidBy: string;
    addExpenseWeb: string;
    getApp: string;
    openApp: string;
    joinHint: string;
    deletedUser: string;
    formerMember: string;
    unknownUser: string;
    noExpenses: string;
    footnote: string;
};

const COPY: Record<Language, PublicGroupPageCopy> = {
    en: {
        pageTitle: 'Group balances',
        balancesHeading: 'Who owes whom',
        recentHeading: 'Recent expenses',
        allSettled: 'Everyone is settled up',
        owes: '{{from}} owes {{to}} {{amount}}',
        paidBy: 'Paid by {{name}}',
        addExpenseWeb: 'Add an expense on the web',
        getApp: 'Get the app',
        openApp: 'Open in KupaPay',
        joinHint: 'Sign in to add expenses and join this group.',
        deletedUser: 'Deleted user',
        formerMember: 'Former member',
        unknownUser: 'Someone',
        noExpenses: 'No expenses yet',
        footnote: 'Balances update when members add expenses in KupaPay.',
    },
    he: {
        pageTitle: 'יתרות הקבוצה',
        balancesHeading: 'מי חייב למי',
        recentHeading: 'הוצאות אחרונות',
        allSettled: 'כולם מסולקים',
        owes: '{{from}} חייב/ת ל-{{to}} {{amount}}',
        paidBy: 'שולם על ידי {{name}}',
        addExpenseWeb: 'הוסיפו הוצאה באתר',
        getApp: 'הורידו את האפליקציה',
        openApp: 'פתחו ב-KupaPay',
        joinHint: 'התחברו כדי להוסיף הוצאות ולהצטרף לקבוצה.',
        deletedUser: 'משתמש/ת שנמחק/ה',
        formerMember: 'חבר/ה לשעבר',
        unknownUser: 'מישהו',
        noExpenses: 'עדיין אין הוצאות',
        footnote: 'היתרות מתעדכנות כשחברים מוסיפים הוצאות ב-KupaPay.',
    },
    ar: {
        pageTitle: 'أرصدة المجموعة',
        balancesHeading: 'من يدين لمن',
        recentHeading: 'أحدث المصروفات',
        allSettled: 'الجميع مسدّدون',
        owes: '{{from}} يدين لـ {{to}} {{amount}}',
        paidBy: 'دفع {{name}}',
        addExpenseWeb: 'أضف مصروفاً على الويب',
        getApp: 'حمّل التطبيق',
        openApp: 'افتح في KupaPay',
        joinHint: 'سجّل الدخول لإضافة مصروفات والانضمام إلى المجموعة.',
        deletedUser: 'مستخدم محذوف',
        formerMember: 'عضو سابق',
        unknownUser: 'شخص ما',
        noExpenses: 'لا مصروفات بعد',
        footnote: 'تتحدّث الأرصدة عندما يضيف الأعضاء مصروفات في KupaPay.',
    },
    de: {
        pageTitle: 'Gruppensalden',
        balancesHeading: 'Wer schuldet wem',
        recentHeading: 'Letzte Ausgaben',
        allSettled: 'Alle sind ausgeglichen',
        owes: '{{from}} schuldet {{to}} {{amount}}',
        paidBy: 'Bezahlt von {{name}}',
        addExpenseWeb: 'Ausgabe im Web erfassen',
        getApp: 'App holen',
        openApp: 'In KupaPay öffnen',
        joinHint: 'Melde dich an, um Ausgaben hinzuzufügen und der Gruppe beizutreten.',
        deletedUser: 'Gelöschter Nutzer',
        formerMember: 'Ehemaliges Mitglied',
        unknownUser: 'Jemand',
        noExpenses: 'Noch keine Ausgaben',
        footnote: 'Salden aktualisieren sich, wenn Mitglieder Ausgaben in KupaPay erfassen.',
    },
    es: {
        pageTitle: 'Saldos del grupo',
        balancesHeading: 'Quién debe a quién',
        recentHeading: 'Gastos recientes',
        allSettled: 'Todos están al día',
        owes: '{{from}} debe a {{to}} {{amount}}',
        paidBy: 'Pagado por {{name}}',
        addExpenseWeb: 'Añadir un gasto en la web',
        getApp: 'Descargar la app',
        openApp: 'Abrir en KupaPay',
        joinHint: 'Inicia sesión para añadir gastos y unirte al grupo.',
        deletedUser: 'Usuario eliminado',
        formerMember: 'Miembro anterior',
        unknownUser: 'Alguien',
        noExpenses: 'Aún no hay gastos',
        footnote: 'Los saldos se actualizan cuando los miembros añaden gastos en KupaPay.',
    },
    fr: {
        pageTitle: 'Soldes du groupe',
        balancesHeading: 'Qui doit à qui',
        recentHeading: 'Dépenses récentes',
        allSettled: 'Tout le monde est à jour',
        owes: '{{from}} doit {{amount}} à {{to}}',
        paidBy: 'Payé par {{name}}',
        addExpenseWeb: 'Ajouter une dépense sur le web',
        getApp: 'Télécharger l’app',
        openApp: 'Ouvrir dans KupaPay',
        joinHint: 'Connecte-toi pour ajouter des dépenses et rejoindre le groupe.',
        deletedUser: 'Utilisateur supprimé',
        formerMember: 'Ancien membre',
        unknownUser: 'Quelqu’un',
        noExpenses: 'Pas encore de dépenses',
        footnote: 'Les soldes se mettent à jour quand les membres ajoutent des dépenses dans KupaPay.',
    },
    ru: {
        pageTitle: 'Балансы группы',
        balancesHeading: 'Кто кому должен',
        recentHeading: 'Недавние расходы',
        allSettled: 'Все рассчитались',
        owes: '{{from}} должен(а) {{to}} {{amount}}',
        paidBy: 'Оплатил(а) {{name}}',
        addExpenseWeb: 'Добавить расход в вебе',
        getApp: 'Скачать приложение',
        openApp: 'Открыть в KupaPay',
        joinHint: 'Войдите, чтобы добавлять расходы и вступить в группу.',
        deletedUser: 'Удалённый пользователь',
        formerMember: 'Бывший участник',
        unknownUser: 'Кто-то',
        noExpenses: 'Расходов пока нет',
        footnote: 'Балансы обновляются, когда участники добавляют расходы в KupaPay.',
    },
};

export function publicGroupPageCopyFor(locale: Language): PublicGroupPageCopy {
    return COPY[locale];
}

export function publicGroupPageDir(locale: Language): 'rtl' | 'ltr' {
    return isRtlLanguage(locale) ? 'rtl' : 'ltr';
}

export function interpolateCopy(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}
