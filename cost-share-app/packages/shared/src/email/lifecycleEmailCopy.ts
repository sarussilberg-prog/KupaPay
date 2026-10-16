import type { EmailLifecycleTemplateId } from './lifecycleTemplates.ts';

/** Mirror {@link ../i18n/languages#Language} — inlined so Deno edge bundles resolve without Node-style imports. */
type Language = 'en' | 'he' | 'ru' | 'ar' | 'fr' | 'es' | 'de';

export type LifecycleEmailCopy = { subject: string; preview: string; bodyHtml: string };

const WELCOME: Record<Language, LifecycleEmailCopy> = {
    en: {
        subject: 'Welcome to KupaPay',
        preview: 'Split bills with friends in minutes.',
        bodyHtml:
            '<p>Thanks for joining KupaPay. Create a group, add your first expense, and invite friends to split fairly.</p>',
    },
    he: {
        subject: 'ברוכים הבאים ל-KupaPay',
        preview: 'מחלקים חשבונות עם חברים בדקות.',
        bodyHtml:
            '<p dir="rtl">תודה שהצטרפתם ל-KupaPay. צרו קבוצה, הוסיפו הוצאה ראשונה והזמינו חברים לחלוקה הוגנת.</p>',
    },
    ar: {
        subject: 'مرحبًا بك في KupaPay',
        preview: 'قسّم الفواتير مع الأصدقاء خلال دقائق.',
        bodyHtml:
            '<p dir="rtl">شكرًا لانضمامك إلى KupaPay. أنشئ مجموعة، أضف أول مصروف، وادعُ الأصدقاء للتقسيم العادل.</p>',
    },
    de: {
        subject: 'Willkommen bei KupaPay',
        preview: 'Rechnungen mit Freunden in Minuten teilen.',
        bodyHtml:
            '<p>Danke, dass du KupaPay nutzt. Erstelle eine Gruppe, füge die erste Ausgabe hinzu und lade Freunde ein.</p>',
    },
    es: {
        subject: 'Bienvenido a KupaPay',
        preview: 'Divide gastos con amigos en minutos.',
        bodyHtml:
            '<p>Gracias por unirte a KupaPay. Crea un grupo, añade tu primer gasto e invita amigos.</p>',
    },
    fr: {
        subject: 'Bienvenue sur KupaPay',
        preview: 'Partagez les dépenses entre amis en quelques minutes.',
        bodyHtml:
            '<p>Merci d’avoir rejoint KupaPay. Créez un groupe, ajoutez une première dépense et invitez vos amis.</p>',
    },
    ru: {
        subject: 'Добро пожаловать в KupaPay',
        preview: 'Делите расходы с друзьями за минуты.',
        bodyHtml:
            '<p>Спасибо, что вы с KupaPay. Создайте группу, добавьте первый расход и пригласите друзей.</p>',
    },
};

const FIRST_EXPENSE: Record<Language, LifecycleEmailCopy> = {
    en: {
        subject: 'Add your first expense',
        preview: 'One tap to start tracking shared costs.',
        bodyHtml: '<p>Add an expense to your group so everyone sees who owes what.</p>',
    },
    he: {
        subject: 'הוסיפו הוצאה ראשונה',
        preview: 'הקשה אחת ומתחילים לעקוב.',
        bodyHtml: '<p dir="rtl">הוסיפו הוצאה לקבוצה כדי שכולם יראו מי חייב למי.</p>',
    },
    ar: {
        subject: 'أضف أول مصروف',
        preview: 'خطوة واحدة لتبدأ التتبع.',
        bodyHtml: '<p dir="rtl">أضف مصروفًا إلى مجموعتك ليرى الجميع من يدين لمن.</p>',
    },
    de: {
        subject: 'Erste Ausgabe hinzufügen',
        preview: 'Mit einem Tipp loslegen.',
        bodyHtml: '<p>Füge eine Ausgabe hinzu, damit alle sehen, wer wem schuldet.</p>',
    },
    es: {
        subject: 'Añade tu primer gasto',
        preview: 'Un toque para empezar.',
        bodyHtml: '<p>Añade un gasto a tu grupo para ver quién debe a quién.</p>',
    },
    fr: {
        subject: 'Ajoutez votre première dépense',
        preview: 'Un geste pour commencer.',
        bodyHtml: '<p>Ajoutez une dépense pour que chacun voie qui doit quoi.</p>',
    },
    ru: {
        subject: 'Добавьте первый расход',
        preview: 'Один шаг — и вы в деле.',
        bodyHtml: '<p>Добавьте расход в группу, чтобы все видели балансы.</p>',
    },
};

const INVITE_FRIENDS: Record<Language, LifecycleEmailCopy> = {
    en: {
        subject: 'Invite friends to split smarter',
        preview: 'Shared expenses work best with your crew.',
        bodyHtml: '<p>Send your invite link so friends can join you on KupaPay.</p>',
    },
    he: {
        subject: 'הזמינו חברים לחלוקה חכמה',
        preview: 'הוצאות משותפות עובדות הכי טוב עם החבר\'ה.',
        bodyHtml: '<p dir="rtl">שלחו קישור הזמנה כדי שחברים יצטרפו אליכם ב-KupaPay.</p>',
    },
    ar: {
        subject: 'ادعُ الأصدقاء للتقسيم',
        preview: 'المصروفات المشتركة أفضل مع أصدقائك.',
        bodyHtml: '<p dir="rtl">أرسل رابط الدعوة لينضم الأصدقاء إلى KupaPay.</p>',
    },
    de: {
        subject: 'Freunde einladen',
        preview: 'Gemeinsame Ausgaben laufen besser zu zweit.',
        bodyHtml: '<p>Teile deinen Einladungslink, damit Freunde mitmachen.</p>',
    },
    es: {
        subject: 'Invita a tus amigos',
        preview: 'Los gastos compartidos van mejor en grupo.',
        bodyHtml: '<p>Comparte tu enlace de invitación para que se unan.</p>',
    },
    fr: {
        subject: 'Invitez vos amis',
        preview: 'Les dépenses partagées, c’est mieux à plusieurs.',
        bodyHtml: '<p>Envoyez votre lien d’invitation pour qu’ils vous rejoignent.</p>',
    },
    ru: {
        subject: 'Пригласите друзей',
        preview: 'Совместные траты удобнее с компанией.',
        bodyHtml: '<p>Отправьте ссылку-приглашение, чтобы друзья присоединились.</p>',
    },
};

const WINBACK: Record<Language, LifecycleEmailCopy> = {
    en: {
        subject: 'We miss you on KupaPay',
        preview: 'Your groups are waiting.',
        bodyHtml: '<p>Open KupaPay to catch up on balances and settle up.</p>',
    },
    he: {
        subject: 'מתגעגעים אליכם ב-KupaPay',
        preview: 'הקבוצות שלכם מחכות.',
        bodyHtml: '<p dir="rtl">פתחו את KupaPay כדי לראות יתרות ולסגור חשבונות.</p>',
    },
    ar: {
        subject: 'نفتقدك في KupaPay',
        preview: 'مجموعاتك بانتظارك.',
        bodyHtml: '<p dir="rtl">افتح KupaPay لمتابعة الأرصدة والتسوية.</p>',
    },
    de: {
        subject: 'KupaPay vermisst dich',
        preview: 'Deine Gruppen warten.',
        bodyHtml: '<p>Öffne KupaPay, um Salden zu sehen und auszugleichen.</p>',
    },
    es: {
        subject: 'Te echamos de menos en KupaPay',
        preview: 'Tus grupos te esperan.',
        bodyHtml: '<p>Abre KupaPay para ver saldos y saldar cuentas.</p>',
    },
    fr: {
        subject: 'KupaPay vous manque',
        preview: 'Vos groupes vous attendent.',
        bodyHtml: '<p>Ouvrez KupaPay pour voir les soldes et régler.</p>',
    },
    ru: {
        subject: 'Мы скучаем по вам в KupaPay',
        preview: 'Ваши группы ждут.',
        bodyHtml: '<p>Откройте KupaPay, чтобы проверить балансы и рассчитаться.</p>',
    },
};

const BY_TEMPLATE: Record<EmailLifecycleTemplateId, Record<Language, LifecycleEmailCopy>> = {
    welcome: WELCOME,
    add_first_expense: FIRST_EXPENSE,
    invite_friends: INVITE_FRIENDS,
    inactive_winback: WINBACK,
};

export function lifecycleEmailCopy(
    template: EmailLifecycleTemplateId,
    locale: Language,
): LifecycleEmailCopy {
    const table = BY_TEMPLATE[template];
    return table[locale] ?? table.en;
}
