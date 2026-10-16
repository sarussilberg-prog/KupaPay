# Google Play — subscription offers (KupaPay Pro)

Owner configuration in **Play Console** for `com.kupapay.mobile`. Product IDs must match RevenueCat and the app (`kupapay_pro_monthly`, `kupapay_pro_yearly`).

## Free trial (14 days)

For **both** monthly and yearly base plans:

1. Play Console → **Monetize → Subscriptions** → select `kupapay_pro_monthly` (repeat for `kupapay_pro_yearly`).
2. Open the **base plan** (monthly / yearly billing period).
3. **Offers** → add or edit a **Free trial** offer on that base plan.
4. Set duration to **14 days** (not 7).
5. Save and activate the offer per [Play subscription offer docs](https://support.google.com/googleplay/android-developer/answer/12154973).

RevenueCat reads the live Play offer; the Android app shows **14-day** trial copy when `checkTrialOrIntroductoryPriceEligibility` reports eligible and the product intro price is free.

## EU withdrawal

**No in-app EU waiver checkbox on Android.** Consumer rights and subscription terms are handled in **Google Play’s purchase UI**. The iOS paywall alone shows the optional EU digital-withdrawal acknowledgement (App Store).

## Trip Pass

`kupapay_trip_pass` — one-time or prepaid; **no** subscription free trial.
