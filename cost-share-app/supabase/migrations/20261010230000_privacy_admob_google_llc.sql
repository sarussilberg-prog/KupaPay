-- Privacy: Google LLC (AdMob) processor detail + EU ad gate disclosure (EN + HE).

UPDATE public.legal_documents
SET
    version = '1.2.0',
    effective_date = DATE '2026-10-10',
    content_md = replace(
        content_md,
        E'- **Google AdMob** \u2014 rewarded video ads when you unlock certain features.',
        E'- **Google LLC (AdMob, USA)** \u2014 serves rewarded video ads when you choose to unlock certain features. AdMob may receive device identifiers (for example advertising IDs where permitted by your device and Google\u2019s policies), ad interaction data, approximate location derived from IP address, and diagnostics. We request **non-personalized** ads only; KupaPay does **not** use Apple\u2019s App Tracking Transparency prompt and does **not** access IDFA.'
    )
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'**Rewarded ads** (Google AdMob) may use device advertising identifiers according to Google\u2019s policies when you choose to watch an ad.',
    E'**Rewarded ads** (Google AdMob) are **non-personalized**. KupaPay does not access IDFA. Google may still process limited device/ad data as described in Section 4.2 when you choose to watch an ad.'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry** and **PostHog**, which host data in regions **outside Israel** (including the United States and the European Union).',
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry**, **PostHog**, and **Google LLC (AdMob)** when you use rewarded ads, which host or process data in regions **outside Israel** (including the United States and the European Union).'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'## 5. Cookies and Tracking\n\nThe KupaPay mobile app',
    E'## 5. Cookies, Ads, and Tracking

### 5.1 Rewarded ads (EU / EEA / UK / Switzerland)

We do **not** show Google AdMob rewarded ads to users whose device region is in the European Economic Area, the United Kingdom, or Switzerland. Features that can otherwise be unlocked by watching an ad remain available **without** watching an ad in those regions. We have **not** integrated Google\u2019s User Messaging Platform (UMP) consent form in this version.

### 5.2 Cookies and cross-app tracking

The KupaPay mobile app'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

-- Hebrew (strings produced by 20261010210000_privacy_sentry_posthog.sql)
UPDATE public.legal_documents
SET
    version = '1.2.0',
    effective_date = DATE '2026-10-10',
    content_md = replace(
        content_md,
        E'- **Google AdMob** \u2014 \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05d5\u05d9\u05d3\u05d0\u05d5 \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea when you unlock features.',
        E'- **Google LLC (AdMob, \u05d0\u05e8\u05d4\"\u05d1)** \u2014 \u05de\u05e9\u05e8\u05d4 \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05d5\u05d9\u05d3\u05d0\u05d5 \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea \u05db\u05d0\u05e9\u05e8 \u05d1\u05d5\u05d7\u05e8\u05d9\u05dd \u05dc\u05e4\u05ea\u05d5\u05d7 \u05ea\u05db\u05d5\u05e0\u05d4. AdMob \u05e2\u05e9\u05d5\u05d9 \u05dc\u05e7\u05d1\u05dc \u05de\u05d6\u05d4\u05d9 \u05de\u05db\u05e9\u05d9\u05e8, \u05e0\u05ea\u05d5\u05e0\u05d9 \u05d0\u05d9\u05e0\u05d8\u05e8\u05d0\u05e7\u05e6\u05d9\u05d4 \u05e2\u05dd \u05de\u05d5\u05d3\u05e2\u05d5\u05ea, \u05de\u05d9\u05e7\u05d5\u05dd \u05de\u05e7\u05d5\u05e8\u05d1 \u05de-IP \u05d5\u05d3\u05d9\u05d0\u05d2\u05e0\u05d5\u05e1\u05d8\u05d9\u05e7\u05d4 (\u05dc\u05e4\u05d9 \u05de\u05d3\u05d9\u05e0\u05d9\u05d5\u05ea Google \u05d5\u05d4\u05de\u05db\u05e9\u05d9\u05e8). \u05d0\u05e0\u05d5 \u05de\u05d1\u05e7\u05e9\u05d9\u05dd \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05dc\u05d0-\u05de\u05d5\u05ea\u05d0\u05de\u05d5\u05ea \u05d0\u05d9\u05e9\u05d9\u05ea; KupaPay \u05dc\u05d0 \u05de\u05e6\u05d9\u05d2\u05d4 \u05d0\u05ea \u05d3\u05d9\u05d0\u05dc\u05d5\u05d2 App Tracking Transparency \u05d5\u05dc\u05d0 \u05e0\u05d5\u05d2\u05e2\u05ea \u05dc-IDFA.'
    )
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'**\u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea** (Google AdMob) \u05e2\u05e9\u05d5\u05d9\u05d5\u05ea \u05dc\u05d4\u05e9\u05ea\u05de\u05e9 \u05d1\u05de\u05d6\u05d4\u05d9 \u05e4\u05e8\u05e1\u05d5\u05dd \u05e9\u05dc \u05d4\u05de\u05db\u05e9\u05d9\u05e8 \u05dc\u05e4\u05d9 \u05de\u05d3\u05d9\u05e0\u05d9\u05d5\u05ea Google \u05db\u05d0\u05e9\u05e8 \u05d1\u05d5\u05d7\u05e8\u05d9\u05dd \u05dc\u05e6\u05e4\u05d5\u05ea.',
    E'**\u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea** (Google AdMob) \u05d4\u05df **\u05dc\u05d0-\u05de\u05d5\u05ea\u05d0\u05de\u05d5\u05ea \u05d0\u05d9\u05e9\u05d9\u05ea**. KupaPay \u05dc\u05d0 \u05e0\u05d5\u05d2\u05e2\u05ea \u05dc-IDFA. Google \u05e2\u05e9\u05d5\u05d9\u05d4 \u05dc\u05e2\u05d1\u05d3 \u05e0\u05ea\u05d5\u05e0\u05d9 \u05de\u05db\u05e9\u05d9\u05e8/\u05de\u05d5\u05d3\u05e2\u05d4 \u05de\u05d5\u05d2\u05d1\u05dc\u05d9\u05dd \u05db\u05de\u05ea\u05d5\u05d0\u05e8 \u05d1\u05e1\u05e2\u05d9\u05e3 4.2 \u05db\u05d0\u05e9\u05e8 \u05d1\u05d5\u05d7\u05e8\u05d9\u05dd \u05dc\u05e6\u05e4\u05d5\u05ea.'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'\u05d4\u05de\u05d9\u05d3\u05e2 \u05e9\u05dc\u05da \u05de\u05e2\u05d5\u05d1\u05d3 \u05d5\u05e0\u05e9\u05de\u05e8 \u05d0\u05e6\u05dc **Supabase**, \u05d5\u05d9\u05d9\u05ea\u05db\u05df \u05d2\u05dd \u05d0\u05e6\u05dc **Sentry** \u05d5-**PostHog**',
    E'\u05d4\u05de\u05d9\u05d3\u05e2 \u05e9\u05dc\u05da \u05de\u05e2\u05d5\u05d1\u05d3 \u05d5\u05e0\u05e9\u05de\u05e8 \u05d0\u05e6\u05dc **Supabase**, \u05d5\u05d9\u05d9\u05ea\u05db\u05df \u05d2\u05dd \u05d0\u05e6\u05dc **Sentry**, **PostHog** \u05d5-**Google LLC (AdMob)** \u05db\u05d0\u05e9\u05e8 \u05e0\u05d5\u05d2\u05e2\u05d9\u05dd \u05d1\u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'## 5. \u05e2\u05d5\u05d2\u05d9\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1\n\n\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05d4\u05de\u05d5\u05d1\u05d9\u05d9\u05dc \u05e9\u05dc KupaPay',
    E'## 5. \u05e2\u05d5\u05d2\u05d9\u05d5\u05ea, \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1

### 5.1 \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea (\u05d0\u05d9\u05d9\u05d7 / EEA / \u05d1\u05e8\u05d9\u05d8\u05e0\u05d9\u05d4 / \u05e9\u05d5\u05d5\u05d9\u05e5)

\u05d0\u05d9\u05df \u05d0\u05e0\u05d5 \u05de\u05e6\u05d9\u05d2\u05d9\u05dd \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea AdMob \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea \u05dc\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05d1\u05d0\u05d6\u05d5\u05e8 \u05de\u05db\u05e9\u05d9\u05e8 \u05d4\u05de\u05d6\u05d4\u05d4 \u05db\u05d0\u05d9\u05d9\u05d7, EEA, \u05d1\u05e8\u05d9\u05d8\u05e0\u05d9\u05d4 \u05d0\u05d5 \u05e9\u05d5\u05d5\u05d9\u05e5. \u05ea\u05db\u05d5\u05e0\u05d5\u05ea \u05d4\u05e0\u05e2\u05d5\u05dc\u05d5\u05ea \u05e0\u05e9\u05d0\u05e8\u05d5\u05ea \u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05dc\u05dc\u05d0 \u05e6\u05e4\u05d9\u05d9\u05d4 \u05d1\u05d0\u05d6\u05d5\u05e8\u05d9\u05dd \u05d0\u05dc\u05d. \u05dc\u05d0 \u05e9\u05d9\u05dc\u05d1\u05e0\u05d5 \u05d0\u05ea Google UMP \u05d1\u05d2\u05e8\u05e1\u05d4 \u05d6\u05d5.

### 5.2 \u05e2\u05d5\u05d2\u05d9\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1 \u05d7\u05e6\u05d9-\u05d0\u05ea\u05e8\u05d9\u05dd

\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05d4\u05de\u05d5\u05d1\u05d9\u05d9\u05dc \u05e9\u05dc KupaPay'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;
