# npm audit policy

## CI gate

`cost-share-app/scripts/ci-npm-audit.sh` runs on PR CI and:

1. Fails on **critical** findings in the `@cost-share/web` production dependency tree (`--omit=dev`).
2. Fails when any **direct** production dependency in `apps/web/package.json` is rated **high** or **critical**.

## Known transitive highs (not CI-blocking)

- **Next.js bundled `postcss@8.4.x`** — pinned inside `next` until a patch release bumps it; marketing site uses patched top-level `postcss` for Tailwind builds.
- **Tailwind CSS 3 dev toolchain** (`braces`, `micromatch`, etc.) — address with a Tailwind 4 migration, not a drive-by bump.

## Monorepo overrides

Root `package.json` `overrides` pin patched `next`, `postcss`, `sharp`, `tar`, and `shell-quote` where npm can dedupe them across workspaces.

## Mobile / Expo

Many remaining advisories are **dev/build-time** transitive deps (Metro, Jest, Expo tooling). Track via Expo SDK upgrades; do not block product PRs on those until upstream patches land.
