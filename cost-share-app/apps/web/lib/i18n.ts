import type { Language } from '@cost-share/shared';

export type { Language };

const translations = {
  he: {
    header: {
      signIn: 'כניסה',
      signOut: 'יציאה',
      hello: 'שלום',
    },
    locale: {
      toggle: 'English',
    },
    hero: {
      headline: 'לחלק הוצאות עם חברים, בלי חישובים',
      subheadline: 'KupaPay מפשטת חובות אוטומטית — פחות העברות, יותר שקט',
      ctaDownload: 'הורד לאייפון',
      ctaSignIn: 'כניסה לאתר',
    },
    features: {
      title: 'למה KupaPay?',
      items: [
        {
          icon: '🔀',
          title: 'פישוט חובות אוטומטי',
          description: 'הקבוצה שילמה 20 פעמים — KupaPay מחשבת שאתה צריך להעביר פעם אחת בלבד',
        },
        {
          icon: '⚡',
          title: 'עדכון בזמן אמת',
          description: 'כל הוצאה מתעדכנת מיידית לכל חברי הקבוצה',
        },
        {
          icon: '👥',
          title: 'קבוצות גמישות',
          description: 'צור קבוצות לטיולים, שכירות, ארוחות — כמה שתרצה',
        },
        {
          icon: '🔒',
          title: 'פרטיות ואבטחה',
          description: 'הנתונים שלך מוגנים ומאובטחים',
        },
      ],
    },
    howItWorks: {
      title: 'איך זה עובד?',
      steps: [
        { title: 'צור קבוצה', description: 'הזמן חברים ב-2 שניות' },
        { title: 'הוסף הוצאות', description: 'מי שילם, כמה, על מי' },
        { title: 'קבל חישוב', description: 'KupaPay מציגה בדיוק מי חייב למי ובכמה' },
      ],
    },
    faq: {
      title: 'שאלות נפוצות',
      items: [
        {
          question: 'מה ההבדל בין KupaPay לאפלקציות אחרות?',
          answer:
            'KupaPay משתמשת באלגוריתם פישוט חובות שמפחית את מספר ההעברות לחברים. במקום 10 העברות בין חברים, אולי תצטרך רק 3.',
        },
        {
          question: 'האם זה בחינם?',
          answer: 'כן, KupaPay חינמית לחלוטין.',
        },
        {
          question: 'איך עובד פישוט החובות?',
          answer:
            'האפלקציה מחשבת את היתרות הנטו של כל אחד בקבוצה ומוצאת את מינימום ההעברות שמסלקות את כל החובות.',
        },
        {
          question: 'האם אפשר למחוק קבוצה?',
          answer: 'כן, ניתן לסגור או למחוק קבוצה בכל עת מהגדרות הקבוצה.',
        },
        {
          question: 'האם הנתונים שלי מאובטחים?',
          answer: 'כן. הנתונים מאוחסנים ב-Supabase עם הצפנה מלאה ואימות דו-שלבי.',
        },
      ],
    },
    footer: {
      privacy: 'מדיניות פרטיות',
      terms: 'תנאי שירות',
      contact: 'יצירת קשר',
      copyright: '© 2026 KupaPay',
    },
    legal: {
      notFound: 'המסמך לא נמצא.',
      backHome: 'חזרה לעמוד הבית',
      effectiveDate: 'תוקף מ-',
    },
  },
  en: {
    header: {
      signIn: 'Sign in',
      signOut: 'Sign out',
      hello: 'Hello',
    },
    locale: {
      toggle: 'עברית',
    },
    hero: {
      headline: 'Split expenses with friends, effortlessly',
      subheadline: 'KupaPay automatically simplifies debts — fewer transfers, less stress',
      ctaDownload: 'Download for iPhone',
      ctaSignIn: 'Sign in',
    },
    features: {
      title: 'Why KupaPay?',
      items: [
        {
          icon: '🔀',
          title: 'Automatic debt simplification',
          description:
            'Your group made 20 payments — KupaPay figures out you only need to transfer once',
        },
        {
          icon: '⚡',
          title: 'Real-time updates',
          description: 'Every expense updates instantly for all group members',
        },
        {
          icon: '👥',
          title: 'Flexible groups',
          description: 'Create groups for trips, rent, dinners — as many as you like',
        },
        {
          icon: '🔒',
          title: 'Privacy & security',
          description: 'Your data is protected and secure',
        },
      ],
    },
    howItWorks: {
      title: 'How it works',
      steps: [
        { title: 'Create a group', description: 'Invite friends in 2 seconds' },
        { title: 'Add expenses', description: 'Who paid, how much, for whom' },
        { title: 'Get the breakdown', description: 'KupaPay shows exactly who owes what' },
      ],
    },
    faq: {
      title: 'FAQ',
      items: [
        {
          question: 'How is KupaPay different from other apps?',
          answer:
            'KupaPay uses a debt-simplification algorithm that reduces the number of transfers between friends. Instead of 10 transfers, you might only need 3.',
        },
        {
          question: 'Is it free?',
          answer: 'Yes, KupaPay is completely free.',
        },
        {
          question: 'How does debt simplification work?',
          answer:
            'The app calculates the net balance for each group member and finds the minimum number of transfers to settle all debts.',
        },
        {
          question: 'Can I delete a group?',
          answer: 'Yes, you can close or delete a group at any time from the group settings.',
        },
        {
          question: 'Is my data secure?',
          answer: 'Yes. Data is stored in Supabase with full encryption and two-factor authentication.',
        },
      ],
    },
    footer: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      contact: 'Contact',
      copyright: '© 2026 KupaPay',
    },
    legal: {
      notFound: 'Document not found.',
      backHome: 'Back to home',
      effectiveDate: 'Effective from ',
    },
  },
} as const;

export type Translations = {
  header: { signIn: string; signOut: string; hello: string };
  locale: { toggle: string };
  hero: { headline: string; subheadline: string; ctaDownload: string; ctaSignIn: string };
  features: {
    title: string;
    items: ReadonlyArray<{ icon: string; title: string; description: string }>;
  };
  howItWorks: {
    title: string;
    steps: ReadonlyArray<{ title: string; description: string }>;
  };
  faq: {
    title: string;
    items: ReadonlyArray<{ question: string; answer: string }>;
  };
  footer: { privacy: string; terms: string; contact: string; copyright: string };
  legal: { notFound: string; backHome: string; effectiveDate: string };
};

export function getTranslations(locale: Language): Translations {
  return translations[locale];
}
