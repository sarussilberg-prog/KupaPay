# KupaPay — instructions for AI agents

## Supabase (read first)

**Mandatory:** [docs/SSOT/SUPABASE_ENVIRONMENTS.md](docs/SSOT/SUPABASE_ENVIRONMENTS.md)

| Git branch | Database |
|------------|----------|
| `main` | **Production** — `jfqxjjjbpxbwwvoygahu` |
| `dev` (and feature branches) | **Development** — `drxfbicunusmipdgbgdk` |

Default MCP (`.mcp.json`) is **development only**. Do not run seed, destructive SQL, or `supabase:fix` on production without explicit user approval.

## Product & architecture SSOT

- [docs/SSOT/README.md](docs/SSOT/README.md)
- [docs/SSOT/SRS.md](docs/SSOT/SRS.md)
- [docs/SSOT/CODE QUALITY.md](docs/SSOT/CODE%20QUALITY.md)
- [docs/SSOT/KNOWN_ISSUES.md](docs/SSOT/KNOWN_ISSUES.md) — bugs & technical gaps (P0–P2)
- [docs/SSOT/TECHNICAL_DEBT.md](docs/SSOT/TECHNICAL_DEBT.md) — intentional deferrals

## Mobile

- [cost-share-app/apps/mobile/AGENTS.md](cost-share-app/apps/mobile/AGENTS.md)

## Pull requests (required — CI blocks merge)

Use [`.github/pull_request_template.md`](.github/pull_request_template.md) on **every** PR (including cloud agents). **PR structure gate** is part of **CI gate**.

1. **Implementation** — full description of what changed and why.
2. **Tests** — list each test file path you changed (must match the diff). App code under `cost-share-app/` needs test changes unless you add label `no-tests-needed` and `No tests needed: <reason>`.
3. **Proof** — explain what the tests assert. Bug fixes (`fix:` title or `bug` label) must include regression tests that **fail on base** and **pass on head** (CI verifies).
4. **Spec** — update a central spec doc ([docs/TESTING.md](docs/TESTING.md) lists paths) or add `Spec: no change needed - <reason>`.

Do not merge with a failing **CI gate** or bypass the structure check.
