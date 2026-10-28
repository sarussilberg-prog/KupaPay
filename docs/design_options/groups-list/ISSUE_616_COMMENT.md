## Groups list redesign — pick an option (Nave)

Issue #616: the shipped **mockup B2** layout on `dev` does not match the earlier **locked spec** in [`docs/superpowers/plans/groups-screeen.md`](../../superpowers/plans/groups-screeen.md) nor the **design-handoff** prototype in [`docs/design_handoff_group_detail/prototype/screens/GroupsListScreen.jsx`](../../design_handoff_group_detail/prototype/screens/GroupsListScreen.jsx).

Below are **three concrete implementations** (light mode + Hebrew RTL each), all scoped to the Groups tab list, with **7 locales** wired where new copy was added.

---

### Option A — Spec classic (locked plan)
**Draft PR:** https://github.com/sarussilberg-prog/KupaPay/pull/626

- Expandable search + filter + subtle **+** in the header
- **Per-currency** balance summary card (green/red lines per currency)
- **“Create a group”** full-width button at the **bottom of the list** (scrolls with groups)
- Keeps **⋮** overflow menu on each row

| English (light) | Hebrew (RTL, light) |
|---|---|
| ![A en](https://raw.githubusercontent.com/sarussilberg-prog/KupaPay/cursor/groups-list-screenshots-be6a/docs/design_options/groups-list/option-a-spec/groups-list-option-a-spec-en-light.png) | ![A he](https://raw.githubusercontent.com/sarussilberg-prog/KupaPay/cursor/groups-list-screenshots-be6a/docs/design_options/groups-list/option-a-spec/groups-list-option-a-spec-he-rtl-light.png) |

**Trade-offs:** Aligns with the written product spec and multi-currency clarity; less “dashboard headline” than B2; create CTA is easy to miss until you scroll the list.

---

### Option B — Design handoff (wordmark + FAB)
**Draft PR:** https://github.com/sarussilberg-prog/KupaPay/pull/627

- **KupaPay wordmark** + always-visible **search row** (filter inline)
- **Section label** (“Your groups · N”) above the list
- **Chevron** rows; **no ⋮ menu on the list** (actions live on group detail / elsewhere)
- **Floating “Create group”** pill above the tab bar

| English (light) | Hebrew (RTL, light) |
|---|---|
| ![B en](https://raw.githubusercontent.com/sarussilberg-prog/KupaPay/cursor/groups-list-screenshots-be6a/docs/design_options/groups-list/option-b-handoff/groups-list-option-b-handoff-en-light.png) | ![B he](https://raw.githubusercontent.com/sarussilberg-prog/KupaPay/cursor/groups-list-screenshots-be6a/docs/design_options/groups-list/option-b-handoff/groups-list-option-b-handoff-he-rtl-light.png) |

**Trade-offs:** Strongest brand presence and scan-friendly sections; removing list-row menus is a **behavior change** unless we add another entry point.

---

### Option C — Mockup B2 (current `dev`)
**Reference draft PR:** https://github.com/sarussilberg-prog/KupaPay/pull/625 (empty diff vs `dev` — baseline for comparison)

- **“My groups”** title + round search/filter/**+** cluster
- Single **net balance** summary card (FX-consolidated headline)
- No list-footer create; create is **header-only**

| English (light) | Hebrew (RTL, light) |
|---|---|
| ![C en](https://raw.githubusercontent.com/sarussilberg-prog/KupaPay/cursor/groups-list-screenshots-be6a/docs/design_options/groups-list/option-c-b2/groups-list-option-c-b2-en-light.png) | ![C he](https://raw.githubusercontent.com/sarussilberg-prog/KupaPay/cursor/groups-list-screenshots-be6a/docs/design_options/groups-list/option-c-b2/groups-list-option-c-b2-he-rtl-light.png) |

**Trade-offs:** Clean headline for total net position; diverges from the locked spec (per-currency summary + list-footer CTA) and from the handoff prototype (wordmark/search/FAB).

---

**Which option should we merge to `dev` — A, B, or C?** (Or a hybrid — e.g. A’s summary + B’s wordmark — call that out explicitly.)

All option branches pass mobile **typecheck** and **Jest** on the agent run; draft PRs are **not** merged.
