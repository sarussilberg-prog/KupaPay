# CI tokens and branch protection (#146, #213)

## Policy

- **PR merge to `dev`:** `GITHUB_TOKEN` only (`gh pr merge --auto` after Sonar + CI).
- **Version bump:** opened as a normal **`chore/version-bump/*` PR** so required checks run; **no `ADMIN_PAT` direct push** to bypass protection.
- **`ADMIN_PAT`:** remove from workflows; rotate/revoke any legacy token used for bypass.

## If version-bump PR creation fails

Enable **Settings → Actions → Allow GitHub Actions to create and approve pull requests**, or bump `cost-share-app/packages/shared/version.json` manually on `dev`.
