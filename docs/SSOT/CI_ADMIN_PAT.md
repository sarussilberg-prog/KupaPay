# CI tokens and branch protection (#146, #213, #602)

## Policy

- **PR merge to `dev`:** **`ADMIN_PAT`** for synchronous `gh pr merge --squash` after Sonar + CI gate (so the merge is not attributed to `github-actions[bot]` and `on: push` bump workflows run). Branch protection **CI gate** applies to PR heads; the admin PAT performs the merge once checks are green.
- **Dev prerelease bump:** after a squash-merge lands on `dev`, [`bump-dev-prerelease.yml`](../../.github/workflows/bump-dev-prerelease.yml) commits `version.json` + `CHANGELOG.md` with **`[skip ci]`** and pushes directly to `dev`. That push must bypass required checks (no full CI/Vercel for a metadata-only commit).
- **`ADMIN_PAT`:** fine-grained or classic PAT owned by a **repo admin**. Stored as the **`ADMIN_PAT`** Actions secret. Used only for:
  - Dev prerelease push (`bump-dev-prerelease.yml` checkout + push)
  - Main semver bump (`bump-version-main.yml`)
  - Branch protection admin workflow (`admin-branch-protection.yml`)
  - Mobile CD baseline / repo variables where `GITHUB_TOKEN` is insufficient

`admin-branch-protection.yml` sets **`enforce_admins: false`**, so the admin PAT can push `[skip ci]` bumps while non-admin pushes still require **CI gate**.

## Secret setup

1. Create a PAT for a dedicated admin bot or owner account with **Contents: read/write** on this repo.
2. Add **`ADMIN_PAT`** under **Settings → Secrets and variables → Actions**.
3. Rotate on schedule or if leaked; update the secret only (workflows reference the name).

## If bump push still fails

- Confirm **`ADMIN_PAT`** is set and the token owner is still a repo **admin**.
- Confirm dev protection still has **`enforce_admins: false`** (re-run `admin-branch-protection` workflow if needed).
- Reconcile backlog: **Actions → Bump dev prerelease → Run workflow** (`workflow_dispatch`) after merges that skipped the bump hook (e.g. before #605’s `pull_request` closed trigger).
- As a one-off, bump `cost-share-app/packages/shared/version.json` on `dev` via PR (full CI) or manual admin push.
