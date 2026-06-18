# KupaPay Web Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current web root that redirects unauthenticated users to `/login` with a bilingual (Hebrew/English) marketing landing page, plus add `/privacy` and `/terms` pages that render legal content from Supabase.

**Architecture:** Single-page landing at `/` (always public, no auth gate) composed from Server Components + one Client Component (`FAQSection`). Language is detected from `Accept-Language` header and persisted in a `locale` cookie. Tailwind CSS added to `apps/web` for styling. Legal pages fetch Markdown from Supabase `legal_documents` and render via `react-markdown`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v3, `@tailwindcss/typography`, `react-markdown`, `@cost-share/shared` (for `Language` / `LegalSlug` types and brand constants), Supabase SSR client.

**Working directory for all commands:** `apps/web` inside the monorepo root.

---

## File Map

| Path | Action | Purpose |
|---|---|---|
| `apps/web/tailwind.config.ts` | Create | Tailwind content globs + typography plugin |
| `apps/web/postcss.config.js` | Create | PostCSS pipeline for Tailwind |
| `apps/web/app/globals.css` | Create | Tailwind directives |
| `apps/web/lib/locale.ts` | Create | Read `locale` cookie / `Accept-Language` header |
| `apps/web/lib/i18n.ts` | Create | Full HE + EN translation dictionary |
| `apps/web/app/api/locale/route.ts` | Create | POST endpoint: sets `locale` cookie, redirects back |
| `apps/web/app/layout.tsx` | Modify | Import globals.css; set dynamic `lang`/`dir` |
| `apps/web/app/_components/LandingHeader.tsx` | Create | Logo, language toggle, auth state |
| `apps/web/app/_components/HeroSection.tsx` | Create | Headline + CTAs |
| `apps/web/app/_components/FeaturesSection.tsx` | Create | 4 feature cards |
| `apps/web/app/_components/HowItWorksSection.tsx` | Create | 3 numbered steps |
| `apps/web/app/_components/FAQSection.tsx` | Create | Accordion (Client Component) |
| `apps/web/app/_components/LandingFooter.tsx` | Create | Links + language toggle + copyright |
| `apps/web/app/_components/LegalPage.tsx` | Create | Shared server component for privacy + terms |
| `apps/web/app/page.tsx` | Rewrite | Landing page (remove auth redirect, compose sections) |
| `apps/web/app/privacy/page.tsx` | Create | Renders `<LegalPage slug="privacy" />` |
| `apps/web/app/terms/page.tsx` | Create | Renders `<LegalPage slug="terms" />` |

---

## Task 1: Install Tailwind CSS

**Files:**
- Modify: `apps/web/package.json` (via npm install)

- [ ] **Step 1: Install packages**

```bash
cd apps/web && npm install -D tailwindcss postcss autoprefixer @tailwindcss/typography
```

Expected: packages added to `devDependencies` in `apps/web/package.json`.

- [ ] **Step 2: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3B82F6',
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#2563EB',
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
```

- [ ] **Step 3: Create `apps/web/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/tailwind.config.ts apps/web/postcss.config.js apps/web/app/globals.css apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add Tailwind CSS v3 + typography plugin"
```

---

## Task 2: Locale utilities

**Files:**
- Create: `apps/web/lib/locale.ts`
- Create: `apps/web/lib/i18n.ts`

- [ ] **Step 1: Create `apps/web/lib/locale.ts`**

```typescript
import { cookies, headers } from 'next/headers';
import type { Language } from '@cost-share/shared';

const LOCALE_COOKIE = 'locale';
const SUPPORTED: Language[] = ['he', 'en'];
const DEFAULT: Language = 'he';

function parseAcceptLanguage(header: string | null): Language {
  if (!header) return DEFAULT;
  const tags = header.split(',').map((s) => s.split(';')[0].trim().toLowerCase());
  for (const tag of tags) {
    const lang = tag.split('-')[0] as Language;
    if ((SUPPORTED as string[]).includes(lang)) return lang;
  }
  return DEFAULT;
}

export async function getLocale(): Promise<Language> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value as Language | undefined;
  if (fromCookie && (SUPPORTED as string[]).includes(fromCookie)) return fromCookie;

  const headerStore = await headers();
  return parseAcceptLanguage(headerStore.get('accept-language'));
}
```

- [ ] **Step 2: Create `apps/web/lib/i18n.ts`**

```typescript
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
          answer: 'KupaPay משתמשת באלגוריתם פישוט חובות שמפחית את מספר ההעברות לחברים. במקום 10 העברות בין חברים, אולי תצטרך רק 3.',
        },
        {
          question: 'האם זה בחינם?',
          answer: 'כן, KupaPay חינמית לחלוטין.',
        },
        {
          question: 'איך עובד פישוט החובות?',
          answer: 'האפלקציה מחשבת את היתרות הנטו של כל אחד בקבוצה ומוצאת את מינימום ההעברות שמסלקות את כל החובות.',
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
          description: 'Your group made 20 payments — KupaPay figures out you only need to transfer once',
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
          answer: 'KupaPay uses a debt-simplification algorithm that reduces the number of transfers between friends. Instead of 10 transfers, you might only need 3.',
        },
        {
          question: 'Is it free?',
          answer: 'Yes, KupaPay is completely free.',
        },
        {
          question: 'How does debt simplification work?',
          answer: 'The app calculates the net balance for each group member and finds the minimum number of transfers to settle all debts.',
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

export type Translations = typeof translations.he;

export function getTranslations(locale: Language): Translations {
  return translations[locale];
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/locale.ts apps/web/lib/i18n.ts
git commit -m "feat(web): add locale detection + i18n translation dictionary"
```

---

## Task 3: Locale API route

**Files:**
- Create: `apps/web/app/api/locale/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/locale/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED = ['he', 'en'];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = formData.get('locale');

  // Redirect back to the same page (same-origin only for safety)
  const referer = request.headers.get('referer') ?? '/';
  let redirectPath = '/';
  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin === new URL(request.url).origin) {
      redirectPath = refererUrl.pathname + refererUrl.search;
    }
  } catch {
    // Invalid referer — fall back to /
  }

  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  if (typeof locale === 'string' && SUPPORTED.includes(locale)) {
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    });
  }

  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/locale/route.ts
git commit -m "feat(web): add locale toggle API route"
```

---

## Task 4: Update `layout.tsx`

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Replace `apps/web/app/layout.tsx` entirely**

```typescript
import type { Metadata } from 'next';
import { APP_BRAND_COLOR, APP_BRAND_TITLE } from '@/lib/brand';
import { getLocale } from '@/lib/locale';
import './globals.css';

export const metadata: Metadata = {
  title: APP_BRAND_TITLE,
  applicationName: APP_BRAND_TITLE,
  description: 'Split expenses with friends',
  appleWebApp: {
    capable: true,
    title: APP_BRAND_TITLE,
    statusBarStyle: 'default',
  },
  themeColor: APP_BRAND_COLOR,
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="antialiased bg-white text-gray-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): import Tailwind globals, set dynamic lang/dir on html"
```

---

## Task 5: `LandingHeader` component

**Files:**
- Create: `apps/web/app/_components/LandingHeader.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/LandingHeader.tsx`**

```typescript
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import { APP_BRAND_TITLE } from '@/lib/brand';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export default async function LandingHeader() {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const otherLocale = locale === 'he' ? 'en' : 'he';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/icon.png" alt={APP_BRAND_TITLE} width={32} height={32} />
          <span className="text-lg font-bold text-blue-500">{APP_BRAND_TITLE}</span>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <form action="/api/locale" method="POST">
            <input type="hidden" name="locale" value={otherLocale} />
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded transition-colors"
            >
              {t.locale.toggle}
            </button>
          </form>

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:block">
                {t.header.hello}, {displayName}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {t.header.signOut}
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-full transition-colors"
            >
              {t.header.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/LandingHeader.tsx
git commit -m "feat(web): add LandingHeader with logo, language toggle, auth state"
```

---

## Task 6: `HeroSection` component

**Files:**
- Create: `apps/web/app/_components/HeroSection.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/HeroSection.tsx`**

```typescript
import Link from 'next/link';
import type { Translations } from '@/lib/i18n';

// TODO: Replace with real App Store URL when app is live
const APP_STORE_URL = 'https://apps.apple.com/app/kupapay';

interface Props {
  t: Translations;
}

export default function HeroSection({ t }: Props) {
  return (
    <section className="bg-gradient-to-b from-white to-blue-50 pt-24 pb-32 px-4 text-center">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
          {t.hero.headline}
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 mb-12 max-w-xl mx-auto leading-relaxed">
          {t.hero.subheadline}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={APP_STORE_URL}
            className="flex items-center gap-2 px-7 py-3.5 bg-gray-900 text-white rounded-full font-semibold text-base hover:bg-gray-700 transition-colors shadow-md"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.4.8 3.22.8.82 0 2.34-.99 3.95-.84 1.03.07 2.64.44 3.6 1.77-3.3 2.02-2.78 6.4.23 7.94-.77 1.5-1.24 2.31-3 3.21zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            {t.hero.ctaDownload}
          </a>
          <Link
            href="/login"
            className="px-7 py-3.5 border-2 border-blue-500 text-blue-500 rounded-full font-semibold text-base hover:bg-blue-50 transition-colors"
          >
            {t.hero.ctaSignIn}
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/HeroSection.tsx
git commit -m "feat(web): add HeroSection"
```

---

## Task 7: `FeaturesSection` component

**Files:**
- Create: `apps/web/app/_components/FeaturesSection.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/FeaturesSection.tsx`**

```typescript
import type { Translations } from '@/lib/i18n';

interface Props {
  t: Translations;
}

export default function FeaturesSection({ t }: Props) {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-14">
          {t.features.title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {t.features.items.map((item) => (
            <div
              key={item.title}
              className="p-7 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/FeaturesSection.tsx
git commit -m "feat(web): add FeaturesSection"
```

---

## Task 8: `HowItWorksSection` component

**Files:**
- Create: `apps/web/app/_components/HowItWorksSection.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/HowItWorksSection.tsx`**

```typescript
import type { Translations } from '@/lib/i18n';

interface Props {
  t: Translations;
}

export default function HowItWorksSection({ t }: Props) {
  return (
    <section className="py-24 px-4 bg-blue-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">
          {t.howItWorks.title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {t.howItWorks.steps.map((step, index) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500 text-white text-xl font-bold flex items-center justify-center mb-5 shadow-md shrink-0">
                {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/HowItWorksSection.tsx
git commit -m "feat(web): add HowItWorksSection"
```

---

## Task 9: `FAQSection` component (Client Component)

**Files:**
- Create: `apps/web/app/_components/FAQSection.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/FAQSection.tsx`**

Note: This is the only Client Component — it needs `useState` for accordion open/close state. The `t` prop is serializable (plain strings/objects) so it can cross the Server→Client boundary.

```typescript
'use client';

import { useState } from 'react';
import type { Translations } from '@/lib/i18n';

interface Props {
  t: Translations;
}

export default function FAQSection({ t }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          {t.faq.title}
        </h2>
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {t.faq.items.map((item, index) => (
            <div key={index}>
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between py-5 text-start gap-4 cursor-pointer"
              >
                <span className="font-medium text-gray-900 text-base">{item.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <p className="pb-5 text-gray-500 text-sm leading-relaxed">
                  {item.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/FAQSection.tsx
git commit -m "feat(web): add FAQSection accordion (Client Component)"
```

---

## Task 10: `LandingFooter` component

**Files:**
- Create: `apps/web/app/_components/LandingFooter.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/LandingFooter.tsx`**

```typescript
import Link from 'next/link';
import type { Translations, Language } from '@/lib/i18n';

interface Props {
  t: Translations;
  locale: Language;
}

export default function LandingFooter({ t, locale }: Props) {
  const otherLocale = locale === 'he' ? 'en' : 'he';

  return (
    <footer className="bg-gray-50 border-t border-gray-100 py-12 px-4">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-5 text-sm text-gray-500">
        <nav className="flex flex-wrap justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-800 transition-colors">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="hover:text-gray-800 transition-colors">
            {t.footer.terms}
          </Link>
          <Link href="/support" className="hover:text-gray-800 transition-colors">
            {t.footer.contact}
          </Link>
        </nav>
        <div className="flex items-center gap-5">
          <form action="/api/locale" method="POST">
            <input type="hidden" name="locale" value={otherLocale} />
            <button
              type="submit"
              className="text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2"
            >
              {t.locale.toggle}
            </button>
          </form>
          <span>{t.footer.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/LandingFooter.tsx
git commit -m "feat(web): add LandingFooter"
```

---

## Task 11: Rewrite `page.tsx` as landing page

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/page.tsx` entirely**

```typescript
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import LandingHeader from './_components/LandingHeader';
import HeroSection from './_components/HeroSection';
import FeaturesSection from './_components/FeaturesSection';
import HowItWorksSection from './_components/HowItWorksSection';
import FAQSection from './_components/FAQSection';
import LandingFooter from './_components/LandingFooter';

// TODO: Uncomment AppPreviewSection when iPhone screenshots are available
// import AppPreviewSection from './_components/AppPreviewSection';

// TODO: Uncomment SocialProofSection when real user metrics are available
// import SocialProofSection from './_components/SocialProofSection';

export default async function Page() {
  const locale = await getLocale();
  const t = getTranslations(locale);

  return (
    <>
      <LandingHeader />
      <main>
        <HeroSection t={t} />
        <FeaturesSection t={t} />
        <HowItWorksSection t={t} />
        {/* <AppPreviewSection t={t} /> */}
        {/* <SocialProofSection t={t} /> */}
        <FAQSection t={t} />
      </main>
      <LandingFooter t={t} locale={locale} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): rewrite root page as public landing page"
```

---

## Task 12: Smoke-test the landing page locally

- [ ] **Step 1: Start the dev server**

```bash
cd apps/web && npm run dev
```

Expected output includes: `▲ Next.js 15.x.x` and `Local: http://localhost:3000`

- [ ] **Step 2: Open http://localhost:3000 in browser**

Check:
- Landing page renders (not a redirect to `/login`)
- Header shows KupaPay logo + "כניסה" button
- Language toggle button shows "English"
- Hero headline in Hebrew visible
- Features, How it works, FAQ, Footer all render
- Clicking "English" toggle switches content to English + sets `dir="ltr"`
- Clicking "כניסה" goes to `/login`

- [ ] **Step 3: Fix any TypeScript / build errors before continuing**

Run: `npx tsc --noEmit` (from `apps/web`)
Expected: no errors

---

## Task 13: Install `react-markdown` + typography

**Files:**
- Modify: `apps/web/package.json` (via npm install)

- [ ] **Step 1: Install packages**

```bash
cd apps/web && npm install react-markdown
```

Expected: `react-markdown` added to `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add react-markdown for legal page rendering"
```

---

## Task 14: `LegalPage` shared component

**Files:**
- Create: `apps/web/app/_components/LegalPage.tsx`

- [ ] **Step 1: Create `apps/web/app/_components/LegalPage.tsx`**

```typescript
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import type { LegalSlug } from '@cost-share/shared';

interface Props {
  slug: LegalSlug;
}

export default async function LegalPage({ slug }: Props) {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const supabase = await createClient();

  const { data } = await supabase
    .from('legal_documents')
    .select('title, content_md, effective_date')
    .eq('slug', slug)
    .eq('locale', locale)
    .eq('is_published', true)
    .maybeSingle();

  return (
    <>
      <LandingHeader />
      <main className="max-w-2xl mx-auto px-4 py-16 min-h-[60vh]">
        {!data ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-6">{t.legal.notFound}</p>
            <Link href="/" className="text-blue-500 hover:underline">
              {t.legal.backHome}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.title}</h1>
            {data.effective_date && (
              <p className="text-sm text-gray-400 mb-10">
                {t.legal.effectiveDate}
                {new Date(data.effective_date).toLocaleDateString(
                  locale === 'he' ? 'he-IL' : 'en-US',
                )}
              </p>
            )}
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown>{data.content_md}</ReactMarkdown>
            </div>
          </>
        )}
      </main>
      <LandingFooter t={t} locale={locale} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/LegalPage.tsx
git commit -m "feat(web): add LegalPage shared component (fetches from Supabase)"
```

---

## Task 15: Privacy and Terms pages

**Files:**
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/terms/page.tsx`

- [ ] **Step 1: Create `apps/web/app/privacy/page.tsx`**

```typescript
import LegalPage from '@/app/_components/LegalPage';

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
```

- [ ] **Step 2: Create `apps/web/app/terms/page.tsx`**

```typescript
import LegalPage from '@/app/_components/LegalPage';

export default function TermsPage() {
  return <LegalPage slug="terms" />;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/privacy/page.tsx apps/web/app/terms/page.tsx
git commit -m "feat(web): add /privacy and /terms pages"
```

---

## Task 16: Final verification

- [ ] **Step 1: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Verify all routes in the running dev server**

| URL | Expected |
|---|---|
| `http://localhost:3000/` | Landing page in Hebrew (RTL) |
| `http://localhost:3000/` (click "English") | Page reloads in English (LTR) |
| `http://localhost:3000/login` | Existing login page (unchanged) |
| `http://localhost:3000/privacy` | Privacy content from Supabase dev DB, or "המסמך לא נמצא" |
| `http://localhost:3000/terms` | Terms content from Supabase dev DB, or "המסמך לא נמצא" |
| `http://localhost:3000/support` | Existing support form (unchanged) |

- [ ] **Step 3: Final commit (if any stray changes)**

```bash
git status
# Commit any remaining changes
```
