# App Store listing draft (do not submit from this file)

Target version: **2.0.0** (repo SSOT `packages/shared/version.json`). Live store build today: 1.2.0.

Character limits checked: Hebrew **name** and **subtitle** ≤ 30; **keywords** ≤ 100.

---

## Hebrew (he-IL) — primary

| Field | Text | Len |
|--------|------|-----|
| **Name** | KupaPay – חלוקת הוצאות | 22 |
| **Subtitle** | קופה משותפת לטיול | 18 |
| **Keywords** | חלוקת הוצאות,קופה,טיול,שותפים,ביט,פייבוקס,Splitwise | 52 |
| **Promotional text** | סלקו חובות בביט או PayBox מהאפליקציה — עברית RTL, בלי מגבלה יומית על חלוקה. | |
| **Description** | KupaPay עוזרת לחלק הוצאות בקבוצות — טיולים, דירת שותפים, אירועים ועוד. הוסיפו הוצאות, צפו במי חייב למי, וסגרו חובות עם קישורי ביט ו-PayBox. ממשק בעברית (RTL) ואנגלית, יתרות במטבעות שונים, תזכורות לסגירה והזמנת חברים. **אין מגבלה יומית על הוספת הוצאות לחלוקה** (בניגוד לאפליקציות שמגבילות פעולות ביום). | |
| **What’s New** | • סגירת חובות עם ביט / PayBox • תמיכה מלאה בעברית (RTL) • קישורי תזכורת לסגירה פותחים את האפליקציה • תיקוני RTL והגדרות חשבון | |

---

## English (en-US)

| Field | Text |
|--------|------|
| **Name** | KupaPay – Split Group Expenses |
| **Subtitle** | Trip & roommate splits |
| **Keywords** | split bills,group expenses,trip,roommates,Bit,PayBox,Hebrew,RTL |
| **Promotional text** | Settle with Bit or PayBox deep links. Hebrew-first RTL. No daily limit on splitting. |
| **Description** | KupaPay makes group expense splitting simple — trips, roommates, events, and more. Add expenses, see who owes whom, and settle up with Bit and PayBox payment links. Full Hebrew (RTL) and English UI, multi-currency balances, settle reminders, and easy invites. **No daily limit on adding expenses to split** (unlike apps that cap daily entries). Optional paid features may be offered in the future. |
| **What’s New** | • Bit / PayBox settle-up links • Hebrew RTL improvements • Reminder links open the app • Stability and account-settings fixes |

---

## Notes for owner

- Ensure **Hebrew** is enabled in App Store Connect localization; iOS bundle declares `he` + `en` via `CFBundleLocalizations` in `apps/mobile/app.json`.
- Screenshots (#62): show Bit/PayBox settle-up, Hebrew RTL home, and “no daily limit on splitting” messaging.
- Do **not** submit until EAS production build is ready; this file is a copy draft only.
- Avoid “free forever” or listing specific features as free in store copy while Pro is planned.
