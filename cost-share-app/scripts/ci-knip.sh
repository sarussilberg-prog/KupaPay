#!/usr/bin/env bash
# Enforce knip dead-code ratchet (mobile + web + shared + repo tooling). Fails when counts exceed baseline.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASELINE="${CI_KNIP_BASELINE:-scripts/ci-knip-baseline.json}"
UPDATE_BASELINE="${UPDATE_CI_KNIP_BASELINE:-0}"

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::jq required for ci-knip.sh" >&2
  exit 1
fi

if [[ ! -f "$BASELINE" ]]; then
  echo "::error::Missing knip baseline: $BASELINE" >&2
  exit 1
fi

echo "=== knip dead-code ratchet ==="

json="$(mktemp)"
trap 'rm -f "$json"' EXIT

knip_log="$(mktemp)"
if ! npx knip --reporter json --no-progress --no-exit-code --no-config-hints >"$json" 2>"$knip_log"; then
  echo "::error::knip JSON reporter failed" >&2
  tail -n 40 "$knip_log" >&2 || true
  exit 1
fi
if ! jq -e '.files and .issues' "$json" >/dev/null 2>&1; then
  echo "::error::knip JSON output missing expected shape" >&2
  tail -n 40 "$knip_log" >&2 || true
  head -c 500 "$json" >&2 || true
  exit 1
fi

actual="$(jq -c '{
  unused_files: (.files | length),
  dependencies: ([.issues[].dependencies[]?] | length),
  devDependencies: ([.issues[].devDependencies[]?] | length),
  unlisted: ([.issues[].unlisted[]?] | length),
  binaries: ([.issues[].binaries[]?] | length),
  unresolved: ([.issues[].unresolved[]?] | length),
  exports: ([.issues[].exports[]?] | length),
  types: ([.issues[].types[]?] | length),
  enumMembers: ([.issues[].enumMembers[]?] | length),
  duplicates: ([.issues[].duplicates[]?] | length)
} | . + {total: (
  .unused_files + .dependencies + .devDependencies + .unlisted + .binaries + .unresolved
  + .exports + .types + .enumMembers + .duplicates
)}' "$json")"

max_total="$(jq -r '.max_total_issues' "$BASELINE")"
actual_total="$(jq -r '.total' <<<"$actual")"

failed=0
while IFS= read -r key; do
  ceiling="$(jq -r --arg k "$key" '.counts[$k] // empty' "$BASELINE")"
  [[ -z "$ceiling" ]] && continue
  count="$(jq -r --arg k "$key" '.[$k]' <<<"$actual")"
  if [[ "$count" -gt "$ceiling" ]]; then
    echo "::error::Knip regression ($key): ${count} > ceiling ${ceiling}" >&2
    failed=1
  else
    echo "✅ knip $key: ${count} (ceiling ${ceiling})"
  fi
done < <(jq -r '.counts | keys[]' "$BASELINE")

if [[ "$actual_total" -gt "$max_total" ]]; then
  echo "::error::Knip total issues: ${actual_total} > max ${max_total}" >&2
  failed=1
else
  echo "✅ knip total: ${actual_total} (max ${max_total})"
fi

if [[ "$failed" -ne 0 ]]; then
  echo ""
  echo "Human-readable knip report:"
  npx knip --max-issues "$max_total" --no-progress --no-config-hints || true
  exit 1
fi

if [[ "$UPDATE_BASELINE" == "1" ]]; then
  tmp="$(mktemp)"
  jq --argjson counts "$(jq '.counts' <<<"$actual")" \
    --argjson max "$actual_total" \
    '.counts = $counts | .max_total_issues = $max' "$BASELINE" >"$tmp" && mv "$tmp" "$BASELINE"
  echo "Updated $BASELINE to current counts (total ${actual_total})"
fi

echo ""
npx knip --max-issues "$max_total" --no-progress --no-config-hints

echo "✅ knip ratchet passed"
