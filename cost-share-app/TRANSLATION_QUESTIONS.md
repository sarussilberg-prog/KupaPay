# Translation decisions (resolved)

Product copy choices for the i18n expansion (issue #147):

1. **Groups** — Use neutral **“group”** wording like English (not Hebrew-style pool/kitty metaphor) in RU, AR, FR, ES, DE.
2. **Tone** — **Friendly but neutral** (no slang like “crew” or “kitty”; prefer friends/group/settle debts).
3. **Consolidate** — Always **debt simplification** (minimum transfers), never currency merge or group merge.
4. **Legal** — Document body stays **EN/HE fallback** from Supabase until localized legal rows exist; UI chrome is translated.
5. **Plurals** — **Russian:** `_one` / `_few` / `_many` / `_other` where i18next plurals apply. **Arabic:** `_zero` / `_one` / `_two` / `_few` / `_many` / `_other`.

CI enforces key parity, placeholder parity, and no English leftovers (with brand/technical allowlist in `localeAllowlist.ts`).
