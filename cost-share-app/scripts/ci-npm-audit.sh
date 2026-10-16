#!/usr/bin/env bash
# Fail CI on critical vulns in @cost-share/web runtime tree, and high/critical on direct prod deps.
# Transitive highs inside Next's bundled postcss and Tailwind 3 dev toolchain are tracked in docs/SSOT/NPM_AUDIT.md
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! npm audit --workspace=@cost-share/web --omit=dev --audit-level=critical; then
  echo "❌ Critical npm audit findings in @cost-share/web (production tree)"
  exit 1
fi

ROOT="$ROOT" node <<'NODE'
const { execSync } = require('child_process');
const path = require('path');
const root = process.env.ROOT || process.cwd();
const pkg = require(path.join(root, 'apps', 'web', 'package.json'));
const prod = new Set(Object.keys(pkg.dependencies || {}));
let auditJson = '';
try {
  auditJson = execSync('npm audit --workspace=@cost-share/web --omit=dev --json', {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  auditJson = e.stdout?.toString() || '{}';
}
const audit = JSON.parse(auditJson || '{}');
const vulns = audit.vulnerabilities || {};
let failed = false;
for (const [name, info] of Object.entries(vulns)) {
  if (!prod.has(name)) continue;
  if (info.severity === 'critical' || info.severity === 'high') {
    console.error(
      `@cost-share/web production dependency "${name}" has ${info.severity} npm audit finding(s).`,
    );
    failed = true;
  }
}
if (failed) process.exit(1);
NODE

echo "✅ @cost-share/web npm audit gate passed"
