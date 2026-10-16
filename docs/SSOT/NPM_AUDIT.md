# npm audit policy

## CI gate

`cost-share-app/scripts/ci-npm-audit.sh` runs on PR CI and fails on **high or critical** findings in `@cost-share/web` (marketing Next.js).

## Monorepo overrides

Root `package.json` `overrides` pin patched `next`, `tar`, and `shell-quote` where npm can dedupe them across workspaces.

## Mobile / Expo

Many remaining advisories are **dev/build-time** transitive deps (Metro, Jest, Expo tooling). Track via Expo SDK upgrades; do not block product PRs on those until upstream patches land.
