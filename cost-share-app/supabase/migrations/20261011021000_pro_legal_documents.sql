-- Pro v1 legal (order: #102 AdMob 20261010230000, security 20261011010000+, then this file): Terms + RevenueCat privacy rows.

UPDATE public.legal_documents
SET
    version = '1.3.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'## 9. Paid Features (Future)\n\nThe Service is currently free. We may introduce optional paid features or subscription plans in the future. Any paid features will be purchased through Apple\'s or Google\'s in-app purchase systems and are subject to their billing rules, including auto-renewal, cancellation, and refund policies. We will disclose any pricing and renewal details before you confirm a purchase.',
        E'## 9. Subscriptions & Trip Pass\n\n1. KupaPay Pro is an auto-renewing subscription, monthly or yearly, at the price shown before purchase. Payment is charged to your Apple ID or Google Play account when you confirm the purchase.\n2. The subscription renews automatically for the same period and price unless you turn off auto-renew at least 24 hours before the current period ends. Your account is charged for the renewal within 24 hours before the period ends.\n3. You can manage or cancel anytime in your App Store or Google Play account settings. Cancellation stops future renewals; Pro stays active until the end of the paid period. Deleting the app or your account does not cancel the subscription.\n4. If we offer a free trial, any unused part of it ends when you buy a subscription.\n5. Trip Pass is a one-time purchase, not a subscription. It unlocks Pro features for every member of one group for 30 days from purchase, then ends automatically with no renewal. The yearly plan includes one Trip Pass, which can be used while the subscription is active.\n6. Purchases are processed by Apple or Google, and refund requests are handled by them under their policies. This doesn\'t limit any rights you have under applicable consumer law.\n7. We\'ll give advance notice of any price change, and you can cancel before it takes effect.'
    )
WHERE slug = 'terms' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET
    version = '1.3.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'## 9. תכונות בתשלום (עתידיות)\n\nהשירות חינמי כיום. ייתכן ונציע בעתיד תכונות בתשלום או תוכניות מנוי. תכונות בתשלום יירכשו דרך מערכות הרכישה הפנים-אפליקציה של Apple ו-Google ויהיו כפופות לכללי החיוב שלהן, לרבות חידוש אוטומטי, ביטול, ומדיניות החזרים. נציג את פרטי המחיר והחידוש לפני אישור הרכישה.',
        E'## 9. מנויים ו-Trip Pass\n\n1. ‏KupaPay Pro הוא מנוי מתחדש אוטומטית, חודשי או שנתי, במחיר שמוצג לפני הרכישה. התשלום מחויב בחשבון Apple ID או Google Play שלך עם אישור הרכישה.\n2. המנוי מתחדש אוטומטית לאותה תקופה ובאותו מחיר, אלא אם מבטלים את החידוש האוטומטי לפחות 24 שעות לפני סוף התקופה. החיוב על החידוש מתבצע בתוך 24 השעות שלפני סוף התקופה.\n3. אפשר לנהל או לבטל את המנוי בכל עת בהגדרות החשבון ב-App Store או ב-Google Play. הביטול עוצר חידושים עתידיים, ו-Pro נשאר פעיל עד סוף התקופה ששולמה. מחיקת האפליקציה או החשבון לא מבטלת את המנוי.\n4. אם מוצעת תקופת ניסיון, החלק שלא נוצל ממנה מסתיים עם רכישת המנוי.\n5. ‏Trip Pass הוא רכישה חד-פעמית ולא מנוי. הוא פותח את תכונות Pro לכל חברי קבוצה אחת למשך 30 יום מהרכישה, ומסתיים אוטומטית בלי חידוש. המנוי השנתי כולל Trip Pass אחד, שאפשר להשתמש בו כל עוד המנוי פעיל.\n6. הרכישות מעובדות על ידי Apple או Google, ובקשות להחזר כספי מטופלות אצלן לפי המדיניות שלהן. אין בכך כדי לגרוע מזכויותיך לפי דין, לרבות דיני הגנת הצרכן.\n7. על שינוי מחיר נודיע מראש, ואפשר לבטל לפני שהוא נכנס לתוקף.'
    )
WHERE slug = 'terms' AND locale = 'he' AND is_published = true;

-- Privacy EN: insert RevenueCat after AdMob #102 processor row (do not revert AdMob text).
UPDATE public.legal_documents
SET
    version = '1.3.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'- **Apple App Store / Google Play** \u2014 for delivering the app and handling in-app purchases or subscriptions when offered.\n- **Google LLC (AdMob, USA)** \u2014 serves rewarded video ads when you choose to unlock certain features.',
        E'- **Apple App Store / Google Play** \u2014 for delivering the app and handling in-app purchases or subscriptions when offered.\n- **RevenueCat, Inc.** (USA) \u2014 manages in-app subscriptions and purchases. It receives an anonymous app user ID, purchase and transaction details, and device and platform information. It does not receive your card details, which stay with Apple or Google.\n- **Google LLC (AdMob, USA)** \u2014 serves rewarded video ads when you choose to unlock certain features.'
    )
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry**, **PostHog**, and **Google LLC (AdMob)** when you use rewarded ads, which host or process data in regions **outside Israel** (including the United States and the European Union).',
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry**, **PostHog**, **RevenueCat**, and **Google LLC (AdMob)** when you use rewarded ads or in-app purchases, which host or process data in regions **outside Israel** (including the United States and the European Union).'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET
    version = '1.3.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'- **Apple App Store / Google Play** \u2014 \u05d4\u05e4\u05e6\u05ea \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05e8\u05db\u05d9\u05e9\u05d5\u05ea/\u05de\u05e0\u05d5\u05d9\u05d9\u05dd when offered.\n- **Google LLC (AdMob, \u05d0\u05e8\u05d4\"\u05d1)** \u2014 \u05de\u05e9\u05e8\u05d4 \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05d5\u05d9\u05d3\u05d0\u05d5 \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea \u05db\u05d0\u05e9\u05e8 \u05d1\u05d5\u05d7\u05e8\u05d9\u05dd \u05dc\u05e4\u05ea\u05d5\u05d7 \u05ea\u05db\u05d5\u05e0\u05d4.',
        E'- **Apple App Store / Google Play** \u2014 \u05d4\u05e4\u05e6\u05ea \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05e8\u05db\u05d9\u05e9\u05d5\u05ea/\u05de\u05e0\u05d5\u05d9\u05d9\u05dd when offered.\n- **RevenueCat, Inc.** (\u05d0\u05e8\u05d4\"\u05d1) \u2014 \u05de\u05e0\u05d4\u05dc\u05ea \u05d0\u05ea \u05d4\u05de\u05e0\u05d5\u05d9\u05d9\u05dd \u05d5\u05d4\u05e8\u05db\u05d9\u05e9\u05d5\u05ea \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4. \u05d4\u05d9\u05d0 \u05de\u05e7\u05d1\u05dc\u05ea \u05de\u05d6\u05d4\u05d4 \u05de\u05e9\u05ea\u05de\u05e9 \u05d0\u05e0\u05d5\u05e0\u05d9 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05e4\u05e8\u05d8\u05d9 \u05e8\u05db\u05d9\u05e9\u05d4 \u05d5\u05e2\u05e1\u05e7\u05d4, \u05d5\u05de\u05d9\u05d3\u05e2 \u05e2\u05dc \u05d4\u05de\u05db\u05e9\u05d9\u05e8 \u05d5\u05d4\u05e4\u05dc\u05d8\u05e4\u05d5\u05e8\u05de\u05d4. \u05d4\u05d9\u05d0 \u05dc\u05d0 \u05de\u05e7\u05d1\u05dc\u05ea \u05d0\u05ea \u05e4\u05e8\u05d8\u05d9 \u05d4\u05db\u05e8\u05d8\u05d9\u05e1 \u05e9\u05dc\u05da, \u05e9\u05e0\u05e9\u05d0\u05e8\u05d9\u05dd \u05d0\u05e6\u05dc Apple \u05d0\u05d5 Google.\n- **Google LLC (AdMob, \u05d0\u05e8\u05d4\"\u05d1)** \u2014 \u05de\u05e9\u05e8\u05d4 \u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05d5\u05d9\u05d3\u05d0\u05d5 \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea \u05db\u05d0\u05e9\u05e8 \u05d1\u05d5\u05d7\u05e8\u05d9\u05dd \u05dc\u05e4\u05ea\u05d5\u05d7 \u05ea\u05db\u05d5\u05e0\u05d4.'
    )
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'\u05d4\u05de\u05d9\u05d3\u05e2 \u05e9\u05dc\u05da \u05de\u05e2\u05d5\u05d1\u05d3 \u05d5\u05e0\u05e9\u05de\u05e8 \u05d0\u05e6\u05dc **Supabase**, \u05d5\u05d9\u05d9\u05ea\u05db\u05df \u05d2\u05dd \u05d0\u05e6\u05dc **Sentry**, **PostHog** \u05d5-**Google LLC (AdMob)** \u05db\u05d0\u05e9\u05e8 \u05e0\u05d5\u05d2\u05e2\u05d9\u05dd \u05d1\u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea',
    E'\u05d4\u05de\u05d9\u05d3\u05e2 \u05e9\u05dc\u05da \u05de\u05e2\u05d5\u05d1\u05d3 \u05d5\u05e0\u05e9\u05de\u05e8 \u05d0\u05e6\u05dc **Supabase**, \u05d5\u05d9\u05d9\u05ea\u05db\u05df \u05d2\u05dd \u05d0\u05e6\u05dc **Sentry**, **PostHog**, **RevenueCat** \u05d5-**Google LLC (AdMob)** \u05db\u05d0\u05e9\u05e8 \u05e0\u05d5\u05d2\u05e2\u05d9\u05dd \u05d1\u05e8\u05db\u05d9\u05e9\u05d5\u05ea \u05d0\u05d5 \u05d1\u05e4\u05e8\u05e1\u05d5\u05de\u05d5\u05ea \u05de\u05ea\u05d2\u05de\u05dc\u05d5\u05ea'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;
