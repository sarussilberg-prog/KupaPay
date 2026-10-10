-- Pro v1 legal: Terms "Subscriptions & Trip Pass" + Privacy RevenueCat processor (EN + HE).

UPDATE public.legal_documents
SET
    version = '1.2.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'## 9. Paid Features (Future)\n\nThe Service is currently free. We may introduce optional paid features or subscription plans in the future. Any paid features will be purchased through Apple\'s or Google\'s in-app purchase systems and are subject to their billing rules, including auto-renewal, cancellation, and refund policies. We will disclose any pricing and renewal details before you confirm a purchase.',
        E'## 9. Subscriptions & Trip Pass\n\n1. KupaPay Pro is an auto-renewing subscription, monthly or yearly, at the price shown before purchase. Payment is charged to your Apple ID or Google Play account when you confirm the purchase.\n2. The subscription renews automatically for the same period and price unless you turn off auto-renew at least 24 hours before the current period ends. Your account is charged for the renewal within 24 hours before the period ends.\n3. You can manage or cancel anytime in your App Store or Google Play account settings. Cancellation stops future renewals; Pro stays active until the end of the paid period. Deleting the app or your account does not cancel the subscription.\n4. If we offer a free trial, any unused part of it ends when you buy a subscription.\n5. Trip Pass is a one-time purchase, not a subscription. It unlocks Pro features for every member of one group for 30 days from purchase, then ends automatically with no renewal. The yearly plan includes one Trip Pass, which can be used while the subscription is active.\n6. Purchases are processed by Apple or Google, and refund requests are handled by them under their policies. This doesn\'t limit any rights you have under applicable consumer law.\n7. We\'ll give advance notice of any price change, and you can cancel before it takes effect.'
    )
WHERE slug = 'terms' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET
    version = '1.2.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'## 9. תכונות בתשלום (עתידיות)\n\nהשירות חינמי כיום. ייתכן ונציע בעתיד תכונות בתשלום או תוכניות מנוי. תכונות בתשלום יירכשו דרך מערכות הרכישה הפנים-אפליקציה של Apple ו-Google ויהיו כפופות לכללי החיוב שלהן, לרבות חידוש אוטומטי, ביטול, ומדיניות החזרים. נציג את פרטי המחיר והחידוש לפני אישור הרכישה.',
        E'## 9. מנויים ו-Trip Pass\n\n1. ‏KupaPay Pro הוא מנוי מתחדש אוטומטית, חודשי או שנתי, במחיר שמוצג לפני הרכישה. התשלום מחויב בחשבון Apple ID או Google Play שלך עם אישור הרכישה.\n2. המנוי מתחדש אוטומטית לאותה תקופה ובאותו מחיר, אלא אם מבטלים את החידוש האוטומטי לפחות 24 שעות לפני סוף התקופה. החיוב על החידוש מתבצע בתוך 24 השעות שלפני סוף התקופה.\n3. אפשר לנהל או לבטל את המנוי בכל עת בהגדרות החשבון ב-App Store או ב-Google Play. הביטול עוצר חידושים עתידיים, ו-Pro נשאר פעיל עד סוף התקופה ששולמה. מחיקת האפליקציה או החשבון לא מבטלת את המנוי.\n4. אם מוצעת תקופת ניסיון, החלק שלא נוצל ממנה מסתיים עם רכישת המנוי.\n5. ‏Trip Pass הוא רכישה חד-פעמית ולא מנוי. הוא פותח את תכונות Pro לכל חברי קבוצה אחת למשך 30 יום מהרכישה, ומסתיים אוטומטית בלי חידוש. המנוי השנתי כולל Trip Pass אחד, שאפשר להשתמש בו כל עוד המנוי פעיל.\n6. הרכישות מעובדות על ידי Apple או Google, ובקשות להחזר כספי מטופלות אצלן לפי המדיניות שלהן. אין בכך כדי לגרוע מזכויותיך לפי דין, לרבות דיני הגנת הצרכן.\n7. על שינוי מחיר נודיע מראש, ואפשר לבטל לפני שהוא נכנס לתוקף.'
    )
WHERE slug = 'terms' AND locale = 'he' AND is_published = true;

-- Privacy EN: RevenueCat processor + transfers abroad
UPDATE public.legal_documents
SET
    version = '1.2.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'- **Apple App Store / Google Play** \u2014 for delivering the app and handling in-app purchases or subscriptions when offered.\n- **Google AdMob** \u2014 rewarded video ads when you unlock certain features.',
        E'- **Apple App Store / Google Play** \u2014 for delivering the app and handling in-app purchases or subscriptions when offered.\n- **RevenueCat, Inc.** (USA) \u2014 manages in-app subscriptions and purchases. It receives an anonymous app user ID, purchase and transaction details, and device and platform information. It does not receive your card details, which stay with Apple or Google.\n- **Google AdMob** \u2014 rewarded video ads when you unlock certain features.'
    )
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry** and **PostHog**, which host data in regions **outside Israel** (including the United States and the European Union).',
    E'Your information is processed and stored by **Supabase**, and may also be processed by **Sentry**, **PostHog**, and **RevenueCat**, which host data in regions **outside Israel** (including the United States and the European Union).'
)
WHERE slug = 'privacy' AND locale = 'en' AND is_published = true;

UPDATE public.legal_documents
SET
    version = '1.2.0',
    effective_date = DATE '2026-10-11',
    content_md = replace(
        content_md,
        E'- **Apple App Store / Google Play** \u2014 הפצת האפליקציה ורכישות/מנויים when offered.\n- **Google AdMob** \u2014 פרסומות וידאו מתגמלות when you unlock features.',
        E'- **Apple App Store / Google Play** \u2014 הפצת האפליקציה ורכישות/מנויים when offered.\n- **RevenueCat, Inc.** (ארה\"ב) \u2014 מנהלת את המנויים והרכישות באפליקציה. היא מקבלת מזהה משתמש אנונימי באפליקציה, פרטי רכישה ועסקה, ומידע על המכשיר והפלטפורמה. היא לא מקבלת את פרטי הכרטיס שלך, שנשארים אצל Apple או Google.\n- **Google AdMob** \u2014 פרסומות וידאו מתגמלות when you unlock features.'
    )
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;

UPDATE public.legal_documents
SET content_md = replace(
    content_md,
    E'המידע שלך מעובד ונשמר אצל **Supabase**, וייתכן גם אצל **Sentry** ו-**PostHog**, המארחים נתונים **מחוץ לישראל** (כולל ארה\"ב ואיחוד אירופי).',
    E'המידע שלך מעובד ונשמר אצל **Supabase**, וייתכן גם אצל **Sentry**, **PostHog** ו-**RevenueCat**, המארחים נתונים **מחוץ לישראל** (כולל ארה\"ב ואיחוד אירופי).'
)
WHERE slug = 'privacy' AND locale = 'he' AND is_published = true;
