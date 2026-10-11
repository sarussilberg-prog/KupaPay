# AdMob rewarded ads — compliance notes

## Non-personalized ads (NPA)

- All rewarded requests use `requestNonPersonalizedAdsOnly: true` (`lib/rewardedAdsCompliance.ts` + `useRewardedAd.ts`).
- The app **does not** call App Tracking Transparency or read **IDFA**. There is **no** `NSUserTrackingUsageDescription` in `app.json`.

## EU / UK / EEA / CH consent

**Choice for this release:** **gate rewarded ads off** for device regions in the EU, EEA, UK, and Switzerland (`isRewardedAdsAllowedInRegion`). Remind / consolidate flows use the same “continue without ad” path as when ads fail to load.

**Not implemented:** Google **UMP** (User Messaging Platform) consent form. A follow-up can integrate UMP and re-enable ads in the EU after consent.

## Privacy policy

See migration `20261010230000_privacy_admob_google_llc.sql` (Google LLC / AdMob processor disclosure).
