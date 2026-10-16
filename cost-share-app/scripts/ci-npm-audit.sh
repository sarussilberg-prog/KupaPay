#!/usr/bin/env bash
# Fail CI on critical/high vulns in the marketing web workspace (production surface).
# Mobile/Metro/Jest transitive issues are tracked via Expo upgrades — see docs/SSOT/NPM_AUDIT.md
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
npm audit --workspace=@cost-share/web --audit-level=high
echo "✅ @cost-share/web npm audit (high+) passed"
