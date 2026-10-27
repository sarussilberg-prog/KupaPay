#!/usr/bin/env bash
# Append Playwright flaky/retry outcomes to the GitHub Actions job summary.
set -euo pipefail

REPORT="${1:-playwright-report/results.json}"
if [[ ! -f "$REPORT" ]]; then
  echo "No Playwright JSON report at $REPORT — skipping flaky summary"
  exit 0
fi
if [[ -z "${GITHUB_STEP_SUMMARY:-}" ]]; then
  exit 0
fi
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

flaky="$(jq -r '
  [.suites[]? .. | .specs[]? | .tests[]?
   | select(.results | length > 1)
   | select(.results[-1].status == "passed" or .results[-1].status == "flaky")
   | (.title // "unknown") + " (" + (.projectName // "project") + ")"
  ] | unique | .[]
' "$REPORT" 2>/dev/null || true)"

{
  echo "### Playwright"
  echo "- Retries in CI: 1 (see \`playwright.config.ts\`)"
  if [[ -z "$flaky" ]]; then
    echo "- Flaky (passed on retry): 0"
  else
    echo "- Flaky (passed on retry):"
    echo "$flaky" | while read -r line; do
      [[ -n "$line" ]] && echo "  - \`$line\`"
    done
  fi
} >>"$GITHUB_STEP_SUMMARY"

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  echo "::warning::Playwright flaky (passed on retry): $line"
done <<<"$flaky"
