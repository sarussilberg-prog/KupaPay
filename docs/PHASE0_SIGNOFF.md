# Phase 0 sign-off tracker

Epic: [#136](https://github.com/sarussilberg-prog/KupaPay/issues/136)

| Gate | Issue | PR | Status |
|------|-------|-----|--------|
| A — single npm ci | #139 | #134 | Merged |
| A — Deno matrix | #140 | #170 | Merged |
| C — webhook contracts | #141 | #169 + follow-up | Fixture + SQL entitlement contract tests |
| G — Sonar before auto-merge | #137 | #171 | Merged |
| B — SQL tests in CI | #138 | #172 + follow-up | Quarantine manifest + full inventory in CI |
| B — staging verify | #142 | #180 | Open |
| I — TestFlight fail-loud | #143 | #173 | Merged |
| CODEOWNERS | #144 | #174 | Merged |
| D — nightly E2E scaffold | #179 | TBD | Open |
| E — shadow migration weekly | #145 | TBD | Open |
| J/K — runbook | #176 | TBD | Open |
| Sentry release validation | #177 | TBD | Open |
| Benchmark + sign-off | #178 | TBD | Open |
| Sync dev ← main | — | #168 | Merged |

## CI efficiency note

Gate A uses one `npm ci` + artifact reuse (see `.github/workflows/ci.yml`). Compare median PR duration before/after in Actions — target ≥40% install time reduction per `docs/PRO_V2_PLAN.md`.

## Owner sign-off

| Role | Approved | Date |
|------|----------|------|
| Engineering | ☐ | |
| Owner (Naveh) | ☐ | |
