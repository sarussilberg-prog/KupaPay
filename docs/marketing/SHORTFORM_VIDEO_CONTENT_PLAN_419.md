# Short-form video content plan (30 days) — #419

**Issue:** [#419](https://github.com/sarussilberg-prog/KupaPay/issues/419) · Part of the [1000 MAU epic](https://github.com/sarussilberg-prog/KupaPay/issues/430)  
**Platforms:** TikTok, YouTube Shorts, Instagram Reels (same vertical master; native captions per locale)  
**Cadence:** 3 posts/week → **13 videos** in 30 days  
**Pillars:** settle-up moment · trip money fights · roommate hacks  

**App facts (verified in repo):** groups; shared expenses with equal/custom splits; per-group balances and simplified “who pays whom”; record settlements; activity feed; invite/share to groups; optional **Splitwise CSV import** (`REQ-GROW-03`); optional **public group balance page** (`/b/<token>`, `REQ-GROW-02`); **settle reminder** from balances (`send_settle_reminder` RPC). Do **not** claim receipt scan, recurring bills, or smart reminders unless labeled Pro/trial in-app.

**Link-in-bio (all CTAs):** `https://kupapay.app/?utm_source={platform}&utm_medium=social&utm_campaign=shortform_419&utm_content=v{nn}`  
Replace `{platform}` with `tiktok`, `youtube`, or `instagram`. Attribution: [MARKETING_ATTRIBUTION.md](../SSOT/MARKETING_ATTRIBUTION.md).

---

## Locales (top 3)

| Locale | Code | Why |
|--------|------|-----|
| English | `en` | Default product/marketing language; SRS + store copy primary. |
| Hebrew | `he` | Core market signal (brand, RTL-first UX); full i18n + RTL in app (`REQ-NFR-02`). |
| Russian | `ru` | Third locale for this plan: called out alongside Hebrew in [REDDIT_TRAVEL_COMMUNITIES_PLAYBOOK.md](../growth/REDDIT_TRAVEL_COMMUNITIES_PLAYBOOK.md) for expat/roommate community pushes; full `ru.json` strings. |

Other app locales: `ar`, `de`, `es`, `fr` — reuse **English** hooks/captions or adapt later; not required for #419 acceptance.

**RTL:** For `he` (and `ar` if added later), paste on-screen text and captions into the editor with a leading RLM (`‏`) or type in a RTL paragraph so numerals and Latin “KupaPay” stay readable.

---

## Publishing workflow (Postiz — no auto-publish)

1. Draft each row below in Postiz as **scheduled draft** only.  
2. **Naveh approves** hook, script, on-screen text, caption, and hashtags per video.  
3. After explicit approval, set publish time in Postiz (TikTok / YouTube / Reels connectors).  
4. **This doc does not authorize publishing** — agents and contractors stop at draft + approval request.

---

## Calendar

| # | Day | Theme | Feature focus |
|---|-----|--------|----------------|
| 1 | 1 | Settle-up | Simplified debts + record settlement |
| 2 | 3 | Trip | Add trip expense, split equally |
| 3 | 5 | Roommate | Group + first expense |
| 4 | 8 | Settle-up | Settle reminder |
| 5 | 10 | Trip | Multi-payer confusion → one ledger |
| 6 | 12 | Roommate | Balances screen / who owes whom |
| 7 | 15 | Settle-up | “Minimum payments” simplified list |
| 8 | 17 | Trip | Invite friends to group |
| 9 | 19 | Roommate | Splitwise CSV import |
| 10 | 22 | Settle-up | Settlement recorded → balances update |
| 11 | 24 | Trip | Activity feed after hostel dinner |
| 12 | 27 | Roommate | Public balance link (opt-in) |
| 13 | 29 | Settle-up | End-of-month close the tab |

Suggested post times (local): 12:00–14:00 or 19:00–21:00; pick one timezone per channel and stay consistent.

---

## Videos (scripts & assets)

### V01 — Day 1 · Settle-up · Simplified debts

**Hook**

| en | he (RTL) | ru |
|----|----------|-----|
| Stop the “who pays who” group chat spiral. | ‏סיימו את ספירול ה״מי מעביר למי״ בוואטסאפ. | Хватит чата «кто кому переводит». |

**Script (~22s)**  
You: “Four friends. Ten expenses. Six DMs.” → Screen record: open group → **Balances** → show simplified debt list (“Minimum” badge if shown). → Tap **Settle up** → record a settlement. → “One app. One truth.”

**Shots:** Face cam hook (3s) → app screen capture (15s) → CTA end card (4s).

**On-screen text:** `Simplified debts` / `‏חובות מסוכמים` / `Кто кому должен`

**Caption (en):** We use KupaPay to split group costs and settle with fewer transfers. Link in bio — groups, expenses, balances, settle-up.  
**Caption (he):** ‏מפצלים הוצאות בקבוצה ומסכמים חובות בלי לרדוף אחרי העברות. קישור בביו — KupaPay.  
**Caption (ru):** Делим расходы в группе и закрываем долги без лишних переводов. Ссылка в био — KupaPay.

**Hashtags:** `#SplitBills #SettleUp #Roommates #TripBudget #KupaPay` (+ `#חובות #שותפים` or `#долги #соседи` on HE/RU posts)

**CTA:** “Link in bio → KupaPay” / «קישור בביו» / «Ссылка в био»

---

### V02 — Day 3 · Trip · Airport coffee split

**Hook**

| en | he | ru |
|----|----|-----|
| Trip rule: if you bought it, log it before boarding. | ‏כלל טיול: קניתם? רושמים לפני העלייה למטוס. | Правило поездки: купил — внеси до посадки. |

**Script (~20s):** Friend buys coffees → quick add expense → **split equally** → balances update. “No ‘you owe me 4.50’ at midnight.”

**Shots:** B-roll coffee cups → add expense form → split selector → balance line.

**On-screen text:** `Split equally` / `‏חלוקה שווה` / `Поровну`

**Caption (en):** Log trip snacks once, split equally, check balances before the next flight. KupaPay — link in bio.  
**Caption (he):** ‏רושמים הוצאות טיול, מחלקים שווה, בודקים יתרות לפני הטיסה הבאה. KupaPay — קישור בביו.  
**Caption (ru):** Вносим траты в поездке, делим поровну, смотрим балансы до следующего рейса. KupaPay — ссылка в био.

**Hashtags:** `#TravelHack #GroupTrip #SplitExpenses #KupaPay` · HE: `#טיול #חלוקתחשבון` · RU: `#путешествие #делимсчет`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V03 — Day 5 · Roommate · New group in 30 seconds

**Hook**

| en | he | ru |
|----|----|-----|
| New apartment? Make the money group before the IKEA run. | ‏דירה חדשה? קודם קבוצת כסף, אחר כך איקאה. | Новая квартира? Сначала группа расходов, потом IKEA. |

**Script (~25s):** Create group → add rent or groceries expense → show member balances. “Roommates track; nobody ‘forgets’ utilities.”

**Shots:** Create group → add expense → balances.

**On-screen text:** `Groups + expenses` / `‏קבוצות והוצאות` / `Группа и траты`

**Caption (en):** Create a roommate group, add shared bills, see who owes what. KupaPay — link in bio.  
**Caption (he):** ‏קבוצה לשותפים, הוצאות משותפות, יתרות ברורות. KupaPay — קישור בביו.  
**Caption (ru):** Группа для соседей, общие траты, понятные балансы. KupaPay — ссылка в био.

**Hashtags:** `#Roommates #SharedExpenses #ApartmentLife #KupaPay` · HE: `#שותפים #דירה` · RU: `#соседи #квартира`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V04 — Day 8 · Settle-up · Remind without awkward texts

**Hook**

| en | he | ru |
|----|----|-----|
| Remind them from the app—not the passive-aggressive text. | ‏תזכורת מהאפליקציה, לא הודעה מרירה. | Напоминание из приложения, а не пассивная агрессия в чате. |

**Script (~24s):** Balances → select debt → **Remind** flow → show activity/push path (don't promise delivery). “They see what they owe in context.”

**Shots:** Balances → remind sheet → activity feed entry.

**On-screen text:** `Settle reminder` / `‏תזכורת לסגירה` / `Напоминание`

**Note:** Reminder availability may include in-app monetization gates; show only what your build displays.

**Caption (en):** Send a settle reminder from balances so the amount stays tied to the group. KupaPay — link in bio.  
**Caption (he):** ‏תזכורת סגירה מהמסך יתרות — הסכום נשאר בהקשר של הקבוצה. KupaPay — קישור בביו.  
**Caption (ru):** Напоминание о долге из экрана балансов — сумма в контексте группы. KupaPay — ссылка в био.

**Hashtags:** `#Adulting #SplitBills #KupaPay` · HE: `#חובות #תזכורת` · RU: `#долги #напоминание`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V05 — Day 10 · Trip · One dinner, four cards

**Hook**

| en | he | ru |
|----|----|-----|
| Four cards paid. Zero idea who’s even. | ‏ארבעה כרטיסים. אף אחד לא יודע מי שווה. | Четыре карты. Никто не знает, кто кому должен. |

**Script (~22s):** Enter one dinner expense, one payer, split across trip group → simplified debts list.

**Shots:** Restaurant b-roll → expense detail → debt list.

**On-screen text:** `One ledger` / `‏ספר אחד` / `Один учёт`

**Caption (en):** One dinner, one expense, splits for the whole trip group — then simplified debts. KupaPay — link in bio.  
**Caption (he):** ‏ארוחה אחת, הוצאה אחת, חלוקה לכל מי שבטיול — ואז חובות מסוכמים. KupaPay — קישור בביו.  
**Caption (ru):** Один ужин, один расход, делим на всю группу — и список долгов. KupaPay — ссылка в био.

**Hashtags:** `#TravelFriends #SplitTheBill #KupaPay` · HE: `#חברים #טיול` · RU: `#друзья #поездка`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V06 — Day 12 · Roommate · Balances > spreadsheet

**Hook**

| en | he | ru |
|----|----|-----|
| Your roommate spreadsheet is always wrong. | ‏גיליון השותפים תמיד שבור. | Таблица соседей всегда с ошибкой. |

**Script (~20s):** Open **Balances** → per-member +/- → simplified pairwise debts. “Math lives in the app.”

**Shots:** Scroll balances → highlight net amounts.

**On-screen text:** `Who owes whom` / `‏מי חייב למי` / `Кто кому`

**Caption (en):** Balances and simplified debts replace the shared spreadsheet. KupaPay — link in bio.  
**Caption (he):** ‏יתרות וחובות מסוכמים במקום גיליון משותף. KupaPay — קישור בביו.  
**Caption (ru):** Балансы и упрощённые долги вместо общей таблицы. KupaPay — ссылка в био.

**Hashtags:** `#RoommateHacks #NoSpreadsheets #KupaPay` · HE: `#שותפים #ללאאקסל` · RU: `#лайфхак #соседи`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V07 — Day 15 · Settle-up · Minimum payments

**Hook**

| en | he | ru |
|----|----|-----|
| Close the group with the fewest transfers possible. | ‏לסגור את הקבוצה במינימום העברות. | Закрыть группу минимумом переводов. |

**Script (~25s):** Show simplified debt list + summary line (e.g. “N payments to settle everyone”) → record one settlement → list shrinks.

**Shots:** Debt list → settlement confirm → updated balances.

**On-screen text:** `Fewer transfers` / `‏פחות העברות` / `Меньше переводов`

**Caption (en):** The app simplifies who pays whom so you need fewer bank transfers. KupaPay — link in bio.  
**Caption (he):** ‏האפליקציה מצמצמת העברות בין חברי הקבוצה. KupaPay — קישור בביו.  
**Caption (ru):** Приложение сокращает число переводов между друзьями. KupaPay — ссылка в био.

**Hashtags:** `#SettleUp #MoneyTips #KupaPay` · HE: `#סגירתחשבון #כסף` · RU: `#финансы #переводы`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V08 — Day 17 · Trip · Invite the group chat

**Hook**

| en | he | ru |
|----|----|-----|
| Stop screenshotting receipts to the trip chat. | ‏תפסיקו לצלם קבלות לקבוצת הוואטסאפ. | Хватит скидывать чеки в общий чат. |

**Script (~23s):** **Invite/share** group link → friend joins → shared expenses appear in **Activity**.

**Shots:** Share sheet → invite → activity feed scroll.

**On-screen text:** `Invite & track` / `‏הזמנה ומעקב` / `Пригласить`

**Caption (en):** Invite trip friends into one group — expenses show up in Activity for everyone. KupaPay — link in bio.  
**Caption (he):** ‏מזמינים חברים לקבוצת טיול — הוצאות מופיעות בפיד לכולם. KupaPay — קישור בביו.  
**Caption (ru):** Приглашаем друзей в группу поездки — траты видны всем в ленте. KupaPay — ссылка в био.

**Hashtags:** `#GroupTravel #TravelTips #KupaPay` · HE: `#טיולקבוצתי` · RU: `#путешествие`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V09 — Day 19 · Roommate · Leaving Splitwise?

**Hook**

| en | he | ru |
|----|----|-----|
| Moving your roommate group off Splitwise? Import first. | ‏עוברים מ-Splitwise? קודם ייבוא. | Уходите с Splitwise? Сначала импорт. |

**Script (~28s):** **Splitwise CSV import** → preview → create group & import → show expenses in list. No competitor bashing; show dated honest comparison on web if linking `/splitwise-alternative`.

**Shots:** Import entry → preview → group with expenses.

**On-screen text:** `Splitwise CSV import` / `‏ייבוא מ-Splitwise` / `Импорт CSV Splitwise`

**Caption (en):** Import a Splitwise group export into KupaPay — preview rows, then create the group. Link in bio.  
**Caption (he):** ‏ייבוא קובץ CSV מ-Splitwise ל-KupaPay — תצוגה מקדימה ויצירת קבוצה. קישור בביו.  
**Caption (ru):** Импорт CSV-экспорта Splitwise в KupaPay — предпросмотр и создание группы. Ссылка в био.

**Hashtags:** `#Splitwise #Roommates #KupaPay` · HE: `#ייבוא #Splitwise` · RU: `#импорт #Splitwise`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V10 — Day 22 · Settle-up · Record payment, not another expense

**Hook**

| en | he | ru |
|----|----|-----|
| Paid them back? That’s a settlement—not a new expense. | ‏החזרתם? זה settlement, לא הוצאה חדשה. | Вернули деньги? Это settlement, не новый расход. |

**Script (~22s):** Settle-up flow → pick payer/receiver → amount → confirm → balances net to zero line.

**Shots:** Settlement form → success → balances.

**On-screen text:** `Record settlement` / `‏רישום תשלום` / `Записать перевод`

**Caption (en):** When someone pays you back, record a settlement — it updates balances without faking a new expense. KupaPay — link in bio.  
**Caption (he):** ‏החזר כסף? רושמים settlement — היתרות מתעדכנות בלי הוצאה מזויפת. KupaPay — קישור בביו.  
**Caption (ru):** Возврат денег — это settlement, балансы обновляются без лишнего расхода. KupaPay — ссылка в био.

**Hashtags:** `#PersonalFinance #Friends #KupaPay` · HE: `#חברים #כסף` · RU: `#друзья #деньги`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V11 — Day 24 · Trip · Activity beats “did you see my message?”

**Hook**

| en | he | ru |
|----|----|-----|
| The trip argument is always “that wasn’t logged.” | ‏הריב בטיול תמיד «זה לא נרשם». | Спор в поездке: «ты это не внёс». |

**Script (~21s):** Add hostel/bar expense → open **Activity** → show expense event chronology with group.

**Shots:** Quick add → activity feed.

**On-screen text:** `Activity feed` / `‏פיד פעילות` / `Лента активности`

**Caption (en):** Every expense and settlement lands in Activity — less “I didn’t see that.” KupaPay — link in bio.  
**Caption (he):** ‏כל הוצאה ו-settlement בפיד — פחות «לא ראיתי». KupaPay — קישור בביו.  
**Caption (ru):** Каждый расход и settlement в ленте — меньше «я не видел». KupaPay — ссылка в био.

**Hashtags:** `#Backpacking #TripLife #KupaPay` · HE: `#טיול #פיד` · RU: `#бэкпекинг`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V12 — Day 27 · Roommate · Share balances (opt-in)

**Hook**

| en | he | ru |
|----|----|-----|
| Need a link that shows balances—not your bank login? | ‏צריך קישור ליתרות בלי לתת סיסמה לבנק? | Нужна ссылка на балансы без доступа к банку? |

**Script (~26s):** Enable **public group balance page** (user opt-in) → copy `/b/…` link → show scoped public view (no PII beyond what the page allows). Stress: optional, revocable.

**Shots:** Settings toggle → copy link → web preview if available.

**On-screen text:** `Optional balance link` / `‏קישור יתרות (אופציונלי)` / `Ссылка на баланс`

**Caption (en):** Opt in to a public balance page (`/b/…`) you can revoke — scoped balances, not bank access. KupaPay — link in bio.  
**Caption (he):** ‏קישור יתרות ציבורי אופציונלי (`/b/…`) — אפשר לבטל; יתרות בלבד. KupaPay — קישור בביו.  
**Caption (ru):** Опциональная публичная страница баланса (`/b/…`) — можно отозвать. KupaPay — ссылка в био.

**Hashtags:** `#Roommates #Transparency #KupaPay` · HE: `#שקיפות #שותפים` · RU: `#прозрачность`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

### V13 — Day 29 · Settle-up · Month-end close

**Hook**

| en | he | ru |
|----|----|-----|
| Last day of the month: settle the group or mute it forever. | ‏סוף חודש: סוגרים חובות או משתיקים את הקבוצה. | Конец месяца: закрыть долги или мьютить чат. |

**Script (~25s):** Recap balances → simplified list → two quick settlements → “Start next month at zero.”

**Shots:** Montage of prior clips (5s) + live settle (15s) + CTA (5s).

**On-screen text:** `Start fresh` / `‏מתחילים מחדש` / `С чистого листа`

**Caption (en):** Month-end: check simplified debts, record settlements, start clean. KupaPay — link in bio.  
**Caption (he):** ‏סוף חודש: חובות מסוכמים, settlements, מתחילים נקי. KupaPay — קישור בביו.  
**Caption (ru):** Конец месяца: долги, settlements, начинаем с нуля. KupaPay — ссылка в био.

**Hashtags:** `#MonthlyReset #SplitBills #KupaPay` · HE: `#סוףחודש #חובות` · RU: `#итогимесяца`

**CTA:** Link in bio → KupaPay / ‏קישור בביו / Ссылка в био

---

## Reuse checklist (per publish)

- [ ] Screen recording from a **dev/demo group** with fake names (no real user data)  
- [ ] CTA + UTM `utm_content=v{nn}` on link-in-bio  
- [ ] Locale: post HE with Hebrew on-screen text; RU with Russian; EN default  
- [ ] Naveh approval logged (comment or Postiz status) before schedule  
- [ ] No invented download numbers, prices, or reviews  

## Related docs

- [MARKETING_ATTRIBUTION.md](../SSOT/MARKETING_ATTRIBUTION.md)  
- [REDDIT_TRAVEL_COMMUNITIES_PLAYBOOK.md](../growth/REDDIT_TRAVEL_COMMUNITIES_PLAYBOOK.md)  
- [SRS.md](../SSOT/SRS.md) — `REQ-GROW-02`, `REQ-GROW-03`, `REQ-BAL-*`, `REQ-SET-*`
