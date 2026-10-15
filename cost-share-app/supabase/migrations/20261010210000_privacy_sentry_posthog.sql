-- Privacy policy: disclose Supabase, Sentry, and PostHog (EN + HE published rows).

UPDATE public.legal_documents
SET
    version = '1.1.0',
    effective_date = DATE '2026-10-10',
    content_md = replace(
        content_md,
        E'### 2.3 Information collected automatically\n\n- **Technical logs** from our infrastructure provider (Supabase): IP address, timestamps of requests, error logs. These are retained for a limited operational period (see Section 7).\n\n### 2.4 What we do NOT collect\n\nWe do **not** collect: precise location, device advertising identifiers (IDFA / Android Ad ID), push-notification tokens, third-party analytics events, microphone or contact data. If we add any of these in the future, we will update this Policy and, where required, request your consent in advance.',
        E'### 2.3 Information collected automatically\n\n- **Account and usage (Supabase):** when you use the Service, our infrastructure provider processes your account identifiers, the content you create (groups, expenses, settlements), and **technical logs** such as IP address, request timestamps, and server error logs. Data is stored on Supabase servers **outside Israel** (see Section 6).\n- **Crash and error diagnostics (Sentry):** when enabled in your app build, we send **error reports and stack traces** plus minimal device/OS context needed to diagnose crashes to Sentry (hosted **outside Israel**). We do not intentionally include expense descriptions, group names, or other user-generated content in crash reports.\n- **Product analytics (PostHog):** when configured, we send **named product events** only (for example sign-in, app opened, first group created, expense added, invite accepted, second member joined a group, settle-up recorded), linked to your **user ID** after sign-in, to measure funnels and retention (such as D7 retention). PostHog is used **without session replay** and **without autocapture of text inputs** in the app. Analytics data is processed **outside Israel**.\n\n### 2.4 What we do NOT collect\n\nWe do **not** collect: precise location, microphone audio, or your contact book. **Rewarded ads** (Google AdMob) may use device advertising identifiers according to Google\u2019s policies when you choose to watch an ad. We do not sell your personal information. If we introduce new categories of data collection, we will update this Policy and, where required, request your consent in advance.'
    )
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'- **Supabase** (Postgres database, authentication, file storage) \u2014 our infrastructure provider.\n- **Google** \u2014 only for authenticating you via Google Sign-In. We do not receive your Google password, contacts, or any data beyond your basic profile.\n- **Apple App Store / Google Play** \u2014 for delivering the app and handling any future in-app purchases.',
    E'- **Supabase** (Postgres database, authentication, file storage) \u2014 our infrastructure provider; processes account data and content you create.\n- **Sentry** \u2014 crash and error reporting for the mobile app.\n- **PostHog** \u2014 product analytics (custom events only; no session replay).\n- **Google** \u2014 for Google Sign-In (and Sign in with Apple where offered). We do not receive your Google password or contacts.\n- **Apple App Store / Google Play** \u2014 for delivering the app and handling in-app purchases or subscriptions when offered.\n- **Google AdMob** \u2014 rewarded video ads when you unlock certain features.'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'Your information is processed and stored by Supabase, which hosts data in regions outside Israel. If you are located in the European Economic Area, the United Kingdom, or Switzerland, we rely on the **Standard Contractual Clauses (SCCs)** to lawfully transfer your data outside the EEA. You can request a copy of the SCCs from us.',
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry** and **PostHog**, which host data in regions **outside Israel** (including the United States and the European Union). If you are located in the European Economic Area, the United Kingdom, or Switzerland, we rely on the **Standard Contractual Clauses (SCCs)** and our providers\u2019 data-processing terms to lawfully transfer your data outside the EEA. You can request a copy of the SCCs from us.'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'- **Analytics.** We do not use any third-party analytics today. If we add an analytics provider, we will update this Policy beforehand.',
    E'- **Analytics.** We use PostHog for product analytics as described in Section 2.3. We may change providers or event names over time; material changes will be reflected in this Policy.'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

-- Hebrew
UPDATE public.legal_documents
SET
    version = '1.1.0',
    effective_date = DATE '2026-10-10',
    content_md = replace(
        content_md,
        E'### 2.3 מידע שנאסף אוטומטית\n\n- **לוגים טכניים** מספק התשתית שלנו (Supabase): כתובת IP, חותמות זמן של בקשות ולוגי שגיאות. אלה נשמרים לתקופת תפעול מוגבלת (ראה סעיף 7).\n\n### 2.4 מה אנחנו **לא** אוספים\n\nאיננו אוספים: מיקום מדויק, מזהי פרסום של מכשירים (IDFA / Android Ad ID), טוקני הודעות push, אירועי אנליטיקה של צד שלישי, מיקרופון, או אנשי קשר. אם נוסיף כל אחד מאלה בעתיד, נעדכן מדיניות זו ונבקש את הסכמתך מראש, היכן שנדרש בדין.',
        E'### 2.3 מידע שנאסף אוטומטית\n\n- **חשבון ושימוש (Supabase):** בעת השימוש בשירות, ספק התשתית מעבד מזהי חשבון, תוכן שאתה יוצר (קבוצות, הוצאות, התחשבנויות) ו**לוגים טכניים** (כתובת IP, חותמות זמן, שגיאות שרת). הנתונים נשמרים בשרתי Supabase **מחוץ לישראל** (ראה סעיף 6).\n- **קריסות ושגיאות (Sentry):** כאשר מופעל בבניית האפליקציה, אנו שולחים **דיווחי שגיאות ו-stack traces** ומידע מינימלי על המכשיר/מערכת ל-Sentry (מארח **מחוץ לישראל**). איננו שולחים בכוונה תיאורי הוצאות, שמות קבוצות או תוכן משתמש אחר בדיווחי קריסה.\n- **אנליטיקת מוצר (PostHog):** כאשר מוגדר, אנו שולחים **אירועי מוצר בשם** בלבד (למשל התחברות, פתיחת אפליקציה, קבוצה ראשונה, הוצאה, קבלת הזמנה, חבר שני בקבוצה, סגירת חוב), מקושרים ל**מזהה המשתמש** לאחר התחברות — למדידת משפכים ושימור (כגון D7). **ללא session replay** ו**ללא autocapture של שדות טקסט** באפליקציה. הנתונים מעובדים **מחוץ לישראל**.\n\n### 2.4 מה אנחנו **לא** אוספים\n\nאיננו אוספים: מיקום מדויק, הקלטת מיקרופון, או ספר אנשי קשר. **פרסומות מתגמלות** (Google AdMob) עשויות להשתמש במזהי פרסום של המכשיר לפי מדיניות Google כאשר בוחרים לצפות. איננו מוכרים מידע אישי. אם נוסיף קטגוריות איסוף חדשות, נעדכן מדיניות זו ונבקש הסכמה כנדרש.'
    )
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'- **Supabase** (מסד נתונים Postgres, אימות, אחסון קבצים) \u2014 ספק התשתית שלנו.\n- **Google** \u2014 אך ורק לאימות באמצעות Google Sign-In. איננו מקבלים את סיסמת Google שלך, אנשי קשר, או כל מידע מעבר לפרופיל הבסיסי שלך.\n- **Apple App Store / Google Play** \u2014 לאספקת האפליקציה ולטיפול ברכישות פנים-אפליקציה עתידיות אם יוצעו.',
    E'- **Supabase** (מסד נתונים, אימות, אחסון) \u2014 ספק התשתית; מעבד נתוני חשבון ותוכן שאתה יוצר.\n- **Sentry** \u2014 דיווח קריסות ושגיאות באפליקציית המובייל.\n- **PostHog** \u2014 אנליטיקת מוצר (אירועים מותאמים בלבד; ללא session replay).\n- **Google** \u2014 Google Sign-In (ו-Sign in with Apple). איננו מקבלים סיסמה או אנשי קשר.\n- **Apple App Store / Google Play** \u2014 הפצת האפליקציה ורכישות/מנויים when offered.\n- **Google AdMob** \u2014 פרסומות וידאו מתגמלות when you unlock features.'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'המידע שלך מעובד ונשמר אצל Supabase, המארחת נתונים באזורים מחוץ לישראל. אם אתה ממוקם באזור הכלכלי האירופי, בבריטניה או בשוויץ, אנו מסתמכים על **הסעיפים החוזיים הסטנדרטיים (SCCs)** של נציבות האיחוד האירופי להעברת מידע מחוץ ל-EEA. ניתן לקבל עותק של ה-SCCs לפי דרישה.',
    E'המידע שלך מעובד ונשמר אצל **Supabase**, וייתכן גם אצל **Sentry** ו-**PostHog**, המארחים נתונים **מחוץ לישראל** (כולל ארה\"ב ואיחוד אירופי). אם אתה באזור הכלכלי האירופי, בבריטניה או בשוויץ, אנו מסתמכים על **SCCs** ותנאי עיבוד של הספקים להעברה מחוץ ל-EEA. ניתן לקבל עותק של ה-SCCs לפי דרישה.'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;
