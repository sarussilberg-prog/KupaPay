# KupaPay Web Landing Page — Design Spec

**Date:** 2026-06-18  
**Author:** Nave (via brainstorming session)  
**Status:** Approved

---

## Overview

Replace the current web root (`/`) — which redirects unauthenticated visitors directly to `/login` — with a polished, bilingual (Hebrew/English) marketing landing page. The page presents KupaPay's value proposition, features, how it works, an FAQ, and links to legal pages. Authenticated users are handled gracefully without being forced out of the landing page.

---

## Goals

- First impression: modern, clean, professional (Wise/Revolut aesthetic)
- Bilingual: Hebrew (default, RTL) and English (LTR), language toggle in header and footer
- Language auto-detected from browser `Accept-Language` header; persisted in a `locale` cookie
- All existing pages (`/login`, `/support`) remain unchanged
- Legal content (`/privacy`, `/terms`) fetched from existing Supabase `legal_documents` table
- No external i18n library; no screenshot/social-proof sections (deferred)

---

## Routing Changes

| Path | Before | After |
|---|---|---|
| `/` | Redirect to `/login` if unauthenticated | Public landing page — no auth gate |
| `/login` | Auth page | Unchanged |
| `/support` | Contact form (existing) | Unchanged (visual update deferred to separate spec) |
| `/privacy` | Does not exist | **New** — fetches from Supabase |
| `/terms` | Does not exist | **New** — fetches from Supabase |

**Authenticated users on `/`:** Header shows their display name and a sign-out link. No redirect away from the landing page.

---

## CSS Strategy

Add **Tailwind CSS** to `apps/web`. The monorepo already uses Tailwind on mobile (NativeWind), so the tooling is familiar. Existing pages (`/login`, `/support`) keep their current inline styles — no migration required. New landing-page components use Tailwind exclusively.

---

## i18n Architecture

No external library. Simple, self-contained approach:

- **`apps/web/lib/locale.ts`** — reads/writes `locale` cookie; falls back to `Accept-Language` header, then `he`
- **`apps/web/lib/i18n.ts`** — translation dictionary `{ he: {...}, en: {...} }` containing all landing-page strings
- **`apps/web/app/layout.tsx`** — sets `<html lang="he" dir="rtl">` or `<html lang="en" dir="ltr">` dynamically from cookie
- **Language toggle** — button in Header and Footer; hits a Next.js Route Handler (`/api/locale`) that sets the cookie and redirects back; no client-side JS needed

---

## File Structure

```
apps/web/
├── tailwind.config.ts              ← new
├── postcss.config.ts               ← new
├── app/
│   ├── layout.tsx                  ← updated: dynamic lang/dir, import globals.css
│   ├── globals.css                 ← new: Tailwind directives
│   ├── page.tsx                    ← rewrite: landing page (Server Component)
│   ├── privacy/
│   │   └── page.tsx                ← new
│   ├── terms/
│   │   └── page.tsx                ← new
│   ├── api/
│   │   └── locale/
│   │       └── route.ts            ← new: POST sets locale cookie
│   └── _components/
│       ├── LandingHeader.tsx       ← logo, language toggle, sign-in CTA
│       ├── HeroSection.tsx
│       ├── FeaturesSection.tsx
│       ├── HowItWorksSection.tsx
│       ├── FAQSection.tsx          ← client component (accordion state)
│       └── LandingFooter.tsx
└── lib/
    ├── i18n.ts                     ← new
    └── locale.ts                   ← new
```

---

## Landing Page Sections

### Header (Sticky)
- Logo (KupaPay icon + wordmark) aligned to reading start (right in RTL, left in LTR)
- Language toggle button (`עברית` / `English`) — POST to `/api/locale`, full-page refresh
- "כניסה / Sign in" CTA button — links to `/login`
- If user is authenticated: shows display name + sign-out form action instead of sign-in CTA
- White background, subtle shadow on scroll (`shadow-sm` + `sticky top-0`)

### Hero
- Full-viewport-height section, gradient background `from-white to-[#F0F7FF]`
- Large bold headline (he: *"לחלק הוצאות עם חברים, בלי חישובים"* / en: *"Split expenses with friends, effortlessly"*)
- Subheadline (he: *"KupaPay מפשטת חובות אוטומטית — פחות העברות, יותר שקט"*)
- Two CTAs: `הורד לאייפון / Download for iPhone` (App Store link) + `כניסה / Sign in`
- App Store link: `https://apps.apple.com/app/kupapay` (placeholder — update when live)

### Features (4 cards)
Grid 2×2 on desktop, 1 column on mobile.

| Icon | HE Title | EN Title | Description (HE) |
|---|---|---|---|
| 🔀 | פישוט חובות אוטומטי | Automatic debt simplification | הקבוצה שילמה 20 פעמים — KupaPay מחשבת שאתה צריך להעביר פעם אחת בלבד |
| ⚡ | עדכון בזמן אמת | Real-time updates | כל הוצאה מתעדכנת מיידית לכל חברי הקבוצה |
| 👥 | קבוצות גמישות | Flexible groups | צור קבוצות לטיולים, שכירות, ארוחות — כמה שתרצה |
| 🔒 | פרטיות ואבטחה | Privacy & security | הנתונים שלך מוגנים ומאובטחים |

### How It Works (3 steps)
Numbered, horizontal on desktop / vertical on mobile.

1. **צור קבוצה / Create a group** — הזמן חברים ב-2 שניות / Invite friends in 2 seconds
2. **הוסף הוצאות / Add expenses** — מי שילם, כמה, על מי / Who paid, how much, for whom
3. **קבל חישוב / Get the breakdown** — KupaPay מציגה בדיוק מי חייב למי ובכמה / KupaPay shows exactly who owes what

### Screenshots / App Preview
> **TODO:** Section placeholder reserved here. Add iPhone mockup screenshots once available. Component stub: `AppPreviewSection.tsx` (commented out in `page.tsx`).

### Social Proof
> **TODO:** Section reserved for future use. Add when real user counts are meaningful. Component stub: `SocialProofSection.tsx` (commented out in `page.tsx`).

### FAQ (Accordion, 5 sample Q&As — edit as needed)

1. **מה ההבדל בין KupaPay לאפלקציות אחרות?** — KupaPay משתמשת באלגוריתם פישוט חובות שמפחית את מספר ההעברות לחברים. במקום 10 העברות בין חברים, אולי תצטרך רק 3.
2. **האם זה בחינם?** — כן, KupaPay חינמית לחלוטין.
3. **איך עובד פישוט החובות?** — האפלקציה מחשבת את היתרות הנטו של כל אחד בקבוצה ומוצאת את מינימום ההעברות שמסלקות את כל החובות.
4. **האם אפשר למחוק קבוצה?** — כן, ניתן לסגור או למחוק קבוצה בכל עת מהגדרות הקבוצה.
5. **האם הנתונים שלי מאובטחים?** — כן. הנתונים מאוחסנים ב-Supabase עם הצפנה מלאה ואימות דו-שלבי.

### Footer
- Row 1 (links): מדיניות פרטיות / Privacy Policy → `/privacy` • תנאי שירות / Terms of Service → `/terms` • יצירת קשר / Contact → `/support`
- Row 2: Language toggle + `© 2026 KupaPay`

---

## Legal Pages (`/privacy`, `/terms`)

Both pages share the same Server Component pattern:

1. Read `locale` cookie (fallback: `he`)
2. Fetch from Supabase: `legal_documents` where `slug = <privacy|terms>`, `locale = <locale>`, `is_published = true`
3. If not found: render a styled 404 message (not a Next.js 404 — stay within the layout)
4. Render: page title, `effective_date`, `content_md` via `react-markdown`
5. Uses the same `LandingHeader` and `LandingFooter` for visual consistency

**Dependency:** `react-markdown` added to `apps/web/package.json`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Legal doc not in DB | Friendly "content coming soon" message, no crash |
| Supabase fetch error on legal page | Show error state with link back to home |
| Language cookie missing | Fall back to `Accept-Language`, then `he` |
| App Store link not live yet | Placeholder `#` with `TODO` comment in code |

---

## Out of Scope (This Spec)

- App preview / screenshots section (`AppPreviewSection.tsx` stub, commented out)
- Social proof section (`SocialProofSection.tsx` stub, commented out)
- Android / Play Store link (iOS only for now)
- Animations beyond basic CSS transitions
- Blog, pricing, or any additional marketing pages
- Redesign of existing `/login` or `/support` pages (support gets a visual match later)
