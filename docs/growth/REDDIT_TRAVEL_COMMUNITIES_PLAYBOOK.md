# Reddit + travel communities playbook (#418)

**Goal:** Value-first participation in travel and roommate communities (Reddit, Facebook, WhatsApp) to drive tracked signups toward **≥ 100 UTM-attributed signups/month** from this channel mix (part of the [1000 MAU epic](https://github.com/sarussilberg-prog/KupaPay/issues/430)).

**Platforms:** Web landing + app deep links (same attribution on iOS/Android). **Do not post** until the owner completes the [approval gate](#owner-approval-gate-mandatory) below.

**Locales:** KupaPay ships **7 locales** (`en`, `he`, `ar`, `ru`, `de`, `es`, `fr`). **Hebrew and Arabic are RTL** — when adapting copy for FB/WhatsApp or non-English subreddit threads, write natively in the thread language; do not mirror English word-for-word. Store screenshots and in-app strings already cover all seven; community copy should match the language of the thread.

---

## Rules of engagement (all communities)

1. **Lead with help**, not the product — answer the question first; mention KupaPay only if it genuinely fits.
2. **No drive-by links** — one contextual link max, only when someone asks for a tool or you share a template you use.
3. **Disclose affiliation** when mentioning the app: e.g. “I work on / helped build KupaPay” or “full disclosure: I’m on the team.”
4. **Never** mass-post the same text, DM strangers, or vote-manipulate.
5. **Use tracked links** from the [UTM table](#utm-links-per-community) (same params on web URL and deep link query string).
6. **Owner approval required** before every post (see gate below).

Subreddit rules, group admin policies, and “self-promo” limits **change often**. Treat the “Rules (summary)” column as **to-verify** before each post: read the sidebar / pinned rules / group description the same day you post.

---

## Owner approval gate (mandatory)

No agent, contractor, or team member may publish to Reddit, Facebook, or WhatsApp groups on behalf of KupaPay without **explicit owner approval** for that specific post.

| Step | Action |
|------|--------|
| 1 | Draft post in this doc’s [templates](#post-templates-no-spam) (pick community + template). |
| 2 | Fill [pre-post checklist](#pre-post-checklist). |
| 3 | Open a comment on [#418](https://github.com/sarussilberg-prog/KupaPay/issues/418) (or owner-designated channel) with: community name, link to thread (or “new top-level post”), full draft text, UTM link used. |
| 4 | **Wait for owner “approved” reply** on that draft. |
| 5 | Post manually; save permalink in the same thread for weekly UTM review. |

**Automated posting is out of scope** for this playbook.

---

## Pre-post checklist

- [ ] Read current community rules (sidebar / About / pinned post) — **to-verify**
- [ ] Post answers a real question or adds a concrete tip (not generic praise)
- [ ] Affiliation disclosed if product is named
- [ ] Link uses `utm_source` + `utm_medium=community` + `utm_campaign=reddit_travel_418` + unique `utm_content`
- [ ] Copy matches thread language (or English if thread is English)
- [ ] Owner approval recorded
- [ ] No statistics or claims unless sourced (see [Claims policy](#claims-policy))

---

## UTM links per community

Base web URL: `https://kupapay.app/`

Attribution is parsed on first open ([`marketingAttribution.ts`](../../cost-share-app/packages/shared/src/analytics/marketingAttribution.ts)); see [MARKETING_ATTRIBUTION.md](../SSOT/MARKETING_ATTRIBUTION.md).

**Campaign:** `utm_campaign=reddit_travel_418`  
**Medium:** `utm_medium=community`  
**Source:** `reddit` | `facebook` | `whatsapp` as below.

| # | Community | Platform | `utm_source` | `utm_content` | Tracked URL |
|---|-----------|----------|--------------|---------------|-------------|
| 1 | r/travel | Reddit | `reddit` | `r_travel` | `https://kupapay.app/?utm_source=reddit&utm_medium=community&utm_campaign=reddit_travel_418&utm_content=r_travel` |
| 2 | r/solotravel | Reddit | `reddit` | `r_solotravel` | `…&utm_content=r_solotravel` |
| 3 | r/roommates | Reddit | `reddit` | `r_roommates` | `…&utm_content=r_roommates` |
| 4 | r/backpacking | Reddit | `reddit` | `r_backpacking` | `…&utm_content=r_backpacking` |
| 5 | r/TravelHacks | Reddit | `reddit` | `r_travelhacks` | `…&utm_content=r_travelhacks` |
| 6 | r/digitalnomad | Reddit | `reddit` | `r_digitalnomad` | `…&utm_content=r_digitalnomad` |
| 7 | r/travelpartners | Reddit | `reddit` | `r_travelpartners` | `…&utm_content=r_travelpartners` |
| 8 | r/shoestring | Reddit | `reddit` | `r_shoestring` | `…&utm_content=r_shoestring` |
| 9 | r/Expats | Reddit | `reddit` | `r_expats` | `…&utm_content=r_expats` |
| 10 | r/onebag | Reddit | `reddit` | `r_onebag` | `…&utm_content=r_onebag` |
| 11 | r/TravelNoPics | Reddit | `reddit` | `r_travelnopics` | `…&utm_content=r_travelnopics` |
| 12 | r/longtermtravel | Reddit | `reddit` | `r_longtermtravel` | `…&utm_content=r_longtermtravel` |
| 13 | r/AskTravel | Reddit | `reddit` | `r_asktravel` | `…&utm_content=r_asktravel` |
| 14 | r/travelvlog | Reddit | `reddit` | `r_travelvlog` | `…&utm_content=r_travelvlog` |
| 15 | r/StudentRoommates (or local sub — verify name) | Reddit | `reddit` | `r_studentroommates` | `…&utm_content=r_studentroommates` |
| 16 | r/roommatefindernyc (example city sub — pick one relevant city) | Reddit | `reddit` | `r_roommate_city` | `…&utm_content=r_roommate_city` |
| 17 | Backpacking / budget travel FB group | Facebook | `facebook` | `fb_backpacking_budget` | `…&utm_source=facebook&utm_medium=community&utm_campaign=reddit_travel_418&utm_content=fb_backpacking_budget` |
| 18 | Solo travel FB group | Facebook | `facebook` | `fb_solo_travel` | `…&utm_content=fb_solo_travel` |
| 19 | Expat / city FB group (target locale) | Facebook | `facebook` | `fb_expat_city` | `…&utm_content=fb_expat_city` |
| 20 | Hostel / trip WhatsApp group (invite-only) | WhatsApp | `whatsapp` | `wa_hostel_trip` | `…&utm_source=whatsapp&utm_medium=community&utm_campaign=reddit_travel_418&utm_content=wa_hostel_trip` |

Full URLs: append the query string from the table to `https://kupapay.app/?` — e.g. row 1:

`https://kupapay.app/?utm_source=reddit&utm_medium=community&utm_campaign=reddit_travel_418&utm_content=r_travel`

**Deep link (optional):** `kupapay://invite?utm_source=reddit&utm_medium=community&utm_campaign=reddit_travel_418&utm_content=r_travel` (same query params).

**Measurement (to-verify in PostHog):** Retention / signup breakdown by `acquisition_channel` and `utm_content`; starter HogQL in [`posthog-retention-by-channel.hogql`](../../cost-share-app/analytics/posthog-retention-by-channel.hogql). Target: **≥ 100** new users/month with `utm_campaign=reddit_travel_418` — confirm exact insight definition with owner.

Machine-readable copy of rows 1–20: [`reddit-travel-utm-links.json`](./reddit-travel-utm-links.json).

---

## 20 communities — rules & fit

**Member counts and exact rule text are not listed here** (not verified in-repo). Verify live before posting.

| # | Community | URL / discovery | Topic fit for KupaPay | Rules (summary) — **to-verify** |
|---|-----------|-----------------|----------------------|----------------------------------|
| 1 | r/travel | https://www.reddit.com/r/travel/ | Trip groups, shared costs, multi-currency | No spam; trip reports welcome; check self-promo / referral rules in sidebar |
| 2 | r/solotravel | https://www.reddit.com/r/solotravel/ | Splitting meals/tours with people met traveling | Often strict on low-effort promotion; help-first comments preferred |
| 3 | r/roommates | https://www.reddit.com/r/roommates/ | Shared rent, utilities, household bills | Housing/ad posts may belong in weekly threads only — **to-verify** |
| 4 | r/backpacking | https://www.reddit.com/r/backpacking/ | Budget trips, group expenses | Gear/trail focus; off-topic promo removed — **to-verify** |
| 5 | r/TravelHacks | https://www.reddit.com/r/TravelHacks/ | Money-saving workflows incl. splitting | Tips format; link posts may need mod approval — **to-verify** |
| 6 | r/digitalnomad | https://www.reddit.com/r/digitalnomad/ | Coliving, shared Airbnbs, team trips | Commercial posts often restricted — **to-verify** |
| 7 | r/travelpartners | https://www.reddit.com/r/travelpartners/ | Finding partners; implicit group budgets | Personal ads rules; no unsolicited DM pitching — **to-verify** |
| 8 | r/shoestring | https://www.reddit.com/r/shoestring/ | Frugal travel; cheap split methods | Anti-spam; avoid affiliate-style links — **to-verify** |
| 9 | r/Expats | https://www.reddit.com/r/Expats/ | Shared housing costs abroad | Relocation advice; product mentions often challenged — disclose affiliation |
| 10 | r/onebag | https://www.reddit.com/r/onebag/ | Light travel; occasional group trips | Narrow scope; only mention splitting if on-topic — **to-verify** |
| 11 | r/TravelNoPics | https://www.reddit.com/r/TravelNoPics/ | Text Q&A; money questions | No pics; quality bar for posts — **to-verify** |
| 12 | r/longtermtravel | https://www.reddit.com/r/longtermtravel/ | Months-long shared rentals | Long-form; low tolerance for ads — **to-verify** |
| 13 | r/AskTravel | https://www.reddit.com/r/AskTravel/ | Direct “how do we split…” questions | Q&A format; answer first — **to-verify** |
| 14 | r/travelvlog | https://www.reddit.com/r/travelvlog/ | Group travel content creators | Video focus; promo rules — **to-verify** |
| 15 | r/studentroommates or university city sub | Search Reddit for `{city} roommates` | Dorm/apartment bill splits | University subs often have posting days — **to-verify** |
| 16 | City roommate sub (e.g. r/roommatefindernyc) | Pick one city aligned with locale push | Local roommate expenses | Many limit listing posts to accounts with karma — **to-verify** |
| 17 | Backpacking / budget travel (Facebook) | Search FB: “backpacking travel” + filter groups | Trip cost spreadsheets | Admin approval to join; no link dumps — **to-verify** |
| 18 | Solo travel (Facebook) | Search FB: “solo travel” | Meeting travelers, splitting day trips | Some groups ban apps entirely — **to-verify** |
| 19 | Expat / Israelis in {city} / Russians abroad etc. | Match **he** / **ru** locale campaigns | Shared flats, event costs | Language-specific group rules — **to-verify** |
| 20 | WhatsApp (hostel board / trip chat) | In-person invite only | End-of-trip settlement | Group admin consent; no cold spam — **to-verify** |

---

## Post templates (no spam)

Use **one** template variant per thread. Replace `{tracked_link}` with the community row from the UTM table. Do not use all caps or multiple links.

### A — Reply: “How do you split trip expenses?”

**When:** r/travel, r/solotravel, r/AskTravel, r/backpacking, solo FB groups.

**English (canonical):**

> We track everything in one group wallet so nobody keeps a mental IOU list. Split uneven items (one person paid for the Airbnb, another for groceries) and settle in the currency you actually use.  
> Full disclosure: I help build [KupaPay]({tracked_link}) — free for normal trip splits. Happy to suggest a low-friction workflow even if you use spreadsheets.

**Locale notes:** For **he** / **ar** threads, write the same structure RTL-friendly (short paragraphs); link label can stay “KupaPay”. For **ru**, **de**, **es**, **fr**, adapt idioms locally — keep disclosure sentence.

### B — Reply: Roommates / shared bills

**When:** r/roommates, city roommate subs, expat FB groups.

**English:**

> What worked for us: one shared “utilities + rent” group, recurring expenses tagged, settle monthly so one person isn’t the permanent bank.  
> Disclosure: I’m on the KupaPay team — {tracked_link} if you want an app built for roommate math (splits + reminders). Not affiliated with your landlord; just a tool.

### C — Reply: Nomad / coliving

**When:** r/digitalnomad, r/Expats, r/longtermtravel.

**English:**

> For coliving we stopped using “you owe me approx €73” messages — shared group, photo of bill attached to the expense, settle when someone moves out.  
> I work on KupaPay ({tracked_link}); use whatever works for you — spreadsheet is fine if everyone updates it.

### D — WhatsApp / small group (short)

**When:** Trip chat after owner is in the group organically.

**English:**

> I use this for our trip IOUs — adds up receipts and shows who owes who: {tracked_link}

**RTL (Hebrew example — adapt):**

> אני משתמש/ת בזה לחישוב חובות בטיול — מוסיפים הוצאות ורואים מי חייב למי: {tracked_link}

### E — Comment-only (no link)

**When:** Rules ban links but question is about methodology.

**English:**

> We use a single shared ledger per trip: every payment logged the day it happens, settle once before anyone flies home. Happy to DM a one-pager template if mods allow.

*Do not DM product links without mod/group permission — **to-verify**.*

---

## Claims policy

- Do **not** cite subreddit subscriber counts, “#1 app”, or competitor comparisons unless sourced in a separate approved doc ([#415](https://github.com/sarussilberg-prog/KupaPay/issues/415)).
- Do **not** promise Pro features or pricing not in the live stores.
- Product capabilities should match [SRS.md](../SSOT/SRS.md) (groups, expenses, settle-up, invites).

---

## Weekly review

1. PostHog: signups / `app_open` where `utm_campaign=reddit_travel_418` (break down `utm_content`).
2. Note which templates and communities produced quality threads (permalink archive on #418).
3. Pause any community that generates rule violations or negative feedback.

---

## Acceptance criteria mapping

| Criterion | Section |
|-----------|---------|
| 20 communities with rules | [20 communities table](#20-communities--rules--fit) |
| Post templates + UTM links | [Templates](#post-templates-no-spam), [UTM table](#utm-links-per-community), [JSON](./reddit-travel-utm-links.json) |
| Owner approves before posting | [Owner approval gate](#owner-approval-gate-mandatory) |
