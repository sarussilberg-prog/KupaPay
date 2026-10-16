#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/generate-legal-bundle.mjs

if ! git diff --quiet -- packages/shared/src/legal/legalMarkdownBundle.generated.ts; then
  echo "::error::legalMarkdownBundle.generated.ts is out of date — run node scripts/generate-legal-bundle.mjs" >&2
  git diff -- packages/shared/src/legal/legalMarkdownBundle.generated.ts
  exit 1
fi

npm test --workspace=@cost-share/mobile -- --testPathPattern=legalLocaleParity --ci
