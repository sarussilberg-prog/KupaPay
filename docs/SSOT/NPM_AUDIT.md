# npm audit policy

## CI gate

`cost-share-app/scripts/ci-npm-audit.sh` runs on PR CI and:

1. Fails on **critical** findings in the `@cost-share/web` production dependency tree (`--omit=dev`).
2. Fails when any **direct** production dependency in `apps/web/package.json` is rated **high** or **critical**.

## Known transitive highs (not CI-blocking)

- **Tailwind CSS 3 dev toolchain** (`braces`, `micromatch`, etc.) — address with a Tailwind 4 migration, not a drive-by bump.
- **Lighthouse / `@lhci/cli` dev tree** — transitive highs (e.g. `basic-ftp`, `extract-zip`, nested tooling) until Lighthouse major upgrades; dev-only, not shipped to mobile or web runtime.

## Monorepo overrides

Root `package.json` `overrides` pin patched `next`, `postcss`, `sharp`, `tar`, and `shell-quote` where npm can dedupe them across workspaces.

- **`markdown-it` / `linkify-it`** (via `react-native-markdown-display` on mobile): root `overrides` plus direct root dependencies pin `14.3.3` / `5.0.2` (GHSA-22p9-wv53-3rq4, GHSA-v245-v573-v5vm, markdown-it resource-consumption). Upstream `react-native-markdown-display@7` still declares `markdown-it@^10`; verified by mobile Jest (`legalMarkdownParse`, `LegalDocumentSheet` RTL).

## Mobile / Expo

Many remaining advisories are **dev/build-time** transitive deps (Metro, Jest, Expo tooling). Track via Expo SDK upgrades; do not block product PRs on those until upstream patches land.

**Group Excel export (`xlsx`):** `@cost-share/mobile` depends on `npm:@e965/xlsx@0.20.3` (SheetJS 0.20.3 on the npm registry) instead of abandoned `xlsx@0.18.x`, clearing GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9 without pulling tarballs from CDN in CI.
