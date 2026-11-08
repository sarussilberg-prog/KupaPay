# Changelog

Internal dev builds use `packages/shared/version.json` (`2.x.y-dev.N`). Store releases use the marketing version only.

## [2.2.0-dev.0] — baseline

- Internal version tracking initialized (marketing version 2.2.0).
## [2.2.0-dev.1] — 2026-10-28
- feat(promo): KupaPay-owned promo codes (supersedes #491) (#623)
## [2.2.0-dev.2] — 2026-10-28
- fix(mobile): readable groups list header on narrow screens (#637)
## [2.2.0-dev.3] — 2026-10-28
- fix(mobile): BottomSheetShell body padding on Receipt OCR & Spending Insights (#640)
## [2.2.0-dev.4] — 2026-10-28
- fix(mobile): stack balance chip with header through 392px (#639)
## [2.2.0-dev.5] — 2026-10-28
- feat(web): split calculator Save as group import (#613) (#644)
## [2.2.0-dev.6] — 2026-10-28
- fix(ci): offline schema contract seed honors DROP FUNCTION (#636) (#645)
## [2.2.0-dev.7] — 2026-10-28
- docs: canonical groups list UI spec (mockup B2) (#646)
## [2.2.0-dev.8] — 2026-10-28
- feat(analytics): automate PostHog MAU dashboard insight tiles (#584) (#647)
## [2.2.0-dev.9] — 2026-10-29
- test(shared): core settlement and balance summary unit tests (#649)
## [2.2.0-dev.10] — 2026-10-29
- feat(mobile): import Splitwise group CSV (#396) (#650)
## [2.2.0-dev.11] — 2026-10-29
- feat(web): Splitwise alternative comparison pages (#415) (#651)
## [2.2.0-dev.12] — 2026-10-29
- [MAU] Localized store screenshots pipeline (iOS 6.7/6.5 + Play) — Refs #409 (#653)
## [2.2.0-dev.13] — 2026-10-29
- fix(ci): treat merged PR as success in auto-merge sync (#602) (#654)
## [2.2.0-dev.14] — 2026-10-29
- fix(mobile): Android-native behavior polish (#429) (#657)
## [2.2.0-dev.15] — 2026-10-29
- feat(web): travel money guides for all locales (#416) (#658)
## [2.2.0-dev.16] — 2026-10-29
- docs(marketing): 30-day TikTok/Shorts/Reels content plan (#419) (#659)
## [2.2.0-dev.17] — 2026-10-29
- fix(store): real AppNavigator store screenshots (#409 follow-up) (#660)
## [2.2.0-dev.18] — 2026-10-29
- feat(growth): ambassador program application, Pro grant, referral codes (#420) (#661)
## [2.2.0-dev.19] — 2026-10-29
- chore(release): merge main into dev for 2.2.0 (#663)
## [2.2.0-dev.20] — 2026-10-29
- fix(store): ASC screenshot upload fileSize/checksum + replace set (#667)
## [2.2.0-dev.21] — 2026-10-29
- fix(store): reuse editable ASC version for 2.2.0 (#671)
## [2.2.0-dev.22] — 2026-10-29
- chore: back-merge main hotfix — marketing login proxy (#675)
## [2.2.0-dev.23] — 2026-10-29
- chore: back-merge main — login proxy hotfix (#673, #677) (#678)
## [2.2.0-dev.24] — 2026-10-29
- fix(mobile): native groups layout, profile friend settle sheet, Maestro device UI (#676)
## [2.2.0-dev.25] — 2026-11-01
- feat(ci): required PR structure gate with red/green proof (#679) (#694)
## [2.2.0-dev.26] — 2026-11-01
- perf(ci): faster Maestro simulator CI — build once, tiers (#687) (#696)
## [2.2.0-dev.27] — 2026-11-01
- fix(web): back-merge #701 — proxy /_expo static assets on marketing site (#703)
## [2.2.0-dev.28] — 2026-11-02
- fix(mobile): guard Activity focus badge clear on iOS (#698) (#707)
## [2.2.0-dev.29] — 2026-11-02
- fix(mobile): unify Bit and PayBox payment app tiles (#700) (#708)
## [2.2.0-dev.30] — 2026-11-02
- ci(mobile): UI quality Phase 5 — AWS Device Farm workflow (gated OFF) (#711)
## [2.2.0-dev.31] — 2026-11-02
- ci(mobile): UI quality Phase 4 — release launch smoke (#710)
## [2.2.0-dev.32] — 2026-11-02
- feat(mobile): UI quality Phase 2 — RTL row guard and xx-long pseudo-locale (#709)
## [2.2.0-dev.33] — 2026-11-02
- fix(pro): RevenueCat webhook environment and entitlement ordering hardening (#712)
## [2.2.0-dev.34] — 2026-11-02
- ci: release launch smoke runs on iOS and Android (#715)
## [2.2.0-dev.35] — 2026-11-02
- fix(activity): iOS Hebrew search placeholder garbled (#716) (#719)
## [2.2.0-dev.36] — 2026-11-02
- fix(tabs): swap Profile/Activity order in RTL (#699) (#720)
## [2.2.0-dev.37] — 2026-11-03
- fix(mobile): eas.json empty PostHog key breaks TestFlight EAS validate (#721)
## [2.2.0-dev.38] — 2026-11-03
- ci(ios): trigger TestFlight on dev when testflight workflow updates (#722)
## [2.2.0-dev.39] — 2026-11-03
- ci(ios): TestFlight after dev PR merge (mobile release paths) (#723)
## [2.2.0-dev.40] — 2026-11-03
- feat(release): default Pro on for dev TestFlight and Play internal (#726)
## [2.2.0-dev.41] — 2026-11-03
- feat(mobile): compact single-row Groups list cards (#724)
## [2.2.0-dev.42] — 2026-11-03
- ci(ios): widen TestFlight dev-merge path filter (#727)
## [2.2.0-dev.43] — 2026-11-03
- ci(ios): TestFlight dev-merge builds current dev tip (#728)
## [2.2.0-dev.44] — 2026-11-03
- fix(mobile): compact GroupCard row flex on iOS New Architecture (#729)
## [2.2.0-dev.45] — 2026-11-03
- fix(mobile): GroupCard horizontal row on inner View (iOS New Arch) (#730)
## [2.2.0-dev.46] — 2026-11-03
- fix(mobile): RTL GroupCard text flush to avatar + layout gap diagnostics (#731)
## [2.2.0-dev.47] — 2026-11-03
- fix(mobile): GroupCard RTL row XOR I18nManager + physical x-order diagnostics (#732)
## [2.2.0-dev.48] — 2026-11-04
- fix(mobile): unified RTL layout — I18nManager mirroring, full-app verification (#733)
## [2.2.0-dev.49] — 2026-11-04
- fix(maestro): xx-long language flow tab bar (single back) (#734)
## [2.2.0-dev.50] — 2026-11-04
- fix(mobile): groups list summary card RTL start alignment (#735)
## [2.2.0-dev.51] — 2026-11-04
- fix(mobile): RTL start-edge alignment — referral screen and rtlTextAlign call sites (#736)
## [2.2.0-dev.52] — 2026-11-05
- fix(pro): subscription lifecycle audit — cancel, refund, referral rewards (#738)
## [2.2.0-dev.53] — 2026-11-05
- fix(mobile): restore transparent animated login logo on iOS 26+ (#737)
## [2.2.0-dev.54] — 2026-11-07
- fix(mobile): center button labels and specific restore purchase toasts (#741)
## [2.2.0-dev.55] — 2026-11-07
- fix(mobile): subscription price, cancel state, Trip Pass, and restore UX (#742)
## [2.2.0-dev.56] — 2026-11-08
- fix(mobile): storefront-safe My Subscription price + hide Trip Pass for Pro (#743)
## [2.2.0-dev.57] — 2026-11-08
- fix(ci): Maestro auth build vs layout fixtures; xx-long deep link (#745)
