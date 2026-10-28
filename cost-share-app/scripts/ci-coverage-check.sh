#!/usr/bin/env bash
# Measure Jest + SQL integration coverage metrics and enforce ratcheting baselines.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-jest-quarantine-lib.sh
source "$ROOT/scripts/ci-jest-quarantine-lib.sh"

BASELINE="${CI_COVERAGE_BASELINE:-scripts/ci-coverage-baseline.json}"
SUMMARY="${CI_COVERAGE_SUMMARY:-apps/mobile/coverage/coverage-summary.json}"
UPDATE_BASELINE="${UPDATE_CI_COVERAGE_BASELINE:-0}"

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::jq required for ci-coverage-check.sh" >&2
  exit 1
fi

JEST_IGNORE=()
while IFS= read -r line; do
  [[ -n "$line" ]] && JEST_IGNORE+=("$line")
done < <(ci_jest_quarantine_ignore_args)

quarantined_jest="$(ci_jest_quarantine_count)"
max_jq="$(jq -r '.metrics.mobile_jest_tests.max_quarantined // empty' "$BASELINE")"
if [[ -n "$max_jq" && "$quarantined_jest" -gt "$max_jq" ]]; then
  echo "::error::Jest quarantine: ${quarantined_jest} > max ${max_jq} (see apps/mobile/__tests__/ci-quarantine.json)" >&2
  exit 1
fi
if [[ -n "$max_jq" ]]; then
  echo "✅ jest quarantine: ${quarantined_jest} (max ${max_jq})"
fi

echo "▶ Jest (mobile workspace) with coverage"
npm test --workspace=@cost-share/mobile -- \
  --coverage \
  --coverageReporters=json-summary \
  --passWithNoTests \
  --ci \
  "${JEST_IGNORE[@]}"

if [[ ! -f "$SUMMARY" ]]; then
  echo "::error::Missing $SUMMARY after Jest run" >&2
  exit 1
fi

aggregate_metric() {
  local glob_csv="$1"
  local field="$2"
  jq -r --arg field "$field" --arg globs "$glob_csv" '
    ($globs | split(",")) as $patterns
    | [
        to_entries[]
        | select(.key != "total")
        | select(.key as $p | [$patterns[] | . as $g | $p | contains($g)] | any)
        | .value[$field].pct
        | select(. != "Unknown")
      ] as $pcts
    | if ($pcts | length) == 0 then "0"
      else (($pcts | add) / ($pcts | length) | . * 100 | round / 100)
      end
  ' "$SUMMARY"
}

check_floor() {
  local scope="$1"
  local metric="$2"
  local actual="$3"
  local floor="$4"
  awk -v scope="$scope" -v metric="$metric" -v actual="$actual" -v floor="$floor" '
    BEGIN {
      if (actual + 0 < floor + 0) {
        printf("::error::Coverage regression (%s %s): %.2f < floor %.2f\n", scope, metric, actual, floor) > "/dev/stderr";
        exit 1;
      }
      printf("✅ %s %s: %.2f (floor %.2f)\n", scope, metric, actual, floor);
    }
  '
}

for scope in mobile_ui mobile_critical; do
  globs="$(jq -r --arg s "$scope" '.metrics[$s].path_globs | join(",")' "$BASELINE")"
  for field in lines statements branches functions; do
    floor="$(jq -r --arg s "$scope" --arg f "$field" '.metrics[$s][$f]' "$BASELINE")"
    actual="$(aggregate_metric "$globs" "$field")"
    check_floor "$scope" "$field" "$actual" "$floor"
    if [[ "$UPDATE_BASELINE" == "1" ]]; then
      tmp="$(mktemp)"
      jq --arg s "$scope" --arg f "$field" --argjson v "$(printf '%.2f' "$actual")" \
        '.metrics[$s][$f] = ($v | tonumber)' "$BASELINE" > "$tmp" && mv "$tmp" "$BASELINE"
    fi
  done
done

sql_tests="$(find supabase/__tests__ -maxdepth 1 -name '*.test.sql' | wc -l | tr -d ' ')"
quarantined="$(jq '[to_entries[] | select(.key != "_comment")] | length' supabase/__tests__/ci-quarantine.json)"
min_sql="$(jq -r '.metrics.sql_integration_tests.min_test_files' "$BASELINE")"
max_q="$(jq -r '.metrics.sql_integration_tests.max_quarantined' "$BASELINE")"

if [[ "$sql_tests" -lt "$min_sql" ]]; then
  echo "::error::SQL integration tests: ${sql_tests} files < floor ${min_sql}" >&2
  exit 1
fi
echo "✅ sql_integration_tests: ${sql_tests} files (floor ${min_sql})"

if [[ "$quarantined" -gt "$max_q" ]]; then
  echo "::error::SQL quarantine: ${quarantined} > max ${max_q} (see ci-quarantine.json)" >&2
  exit 1
fi
echo "✅ sql quarantine: ${quarantined} (max ${max_q})"

web_tests="$(find apps/web -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.mjs' 2>/dev/null | wc -l | tr -d ' ')"
min_web="$(jq -r '.metrics.web_unit_tests.min_test_files' "$BASELINE")"
if [[ "$web_tests" -lt "$min_web" ]]; then
  echo "::error::Web unit tests: ${web_tests} < floor ${min_web}" >&2
  exit 1
fi
echo "▶ Web unit tests (@cost-share/web)"
npm test --workspace=@cost-share/web
echo "✅ web_unit_tests: ${web_tests} files (floor ${min_web})"

echo "✅ CI coverage check passed"
