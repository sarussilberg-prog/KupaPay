#!/usr/bin/env bash
# Blocking mobile Jest run with retry-once flake detection + non-blocking quarantine pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-jest-quarantine-lib.sh
source "$ROOT/scripts/ci-jest-quarantine-lib.sh"

QUARANTINE_FILE="$(ci_jest_quarantine_file)"
ARTIFACT_DIR="apps/mobile/.ci-artifacts/jest"
mkdir -p "$ARTIFACT_DIR"
JEST_JSON_OUT=".ci-artifacts/jest"

mapfile -t QUARANTINED < <(ci_jest_list_quarantined "$QUARANTINE_FILE" || true)

IGNORE_ARGS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && IGNORE_ARGS+=("$line")
done < <(ci_jest_quarantine_ignore_args "$QUARANTINE_FILE")

for q in "${QUARANTINED[@]}"; do
  if [[ ! -f "apps/mobile/$q" ]]; then
    echo "::error::quarantine entry missing file: apps/mobile/$q (see $QUARANTINE_FILE)" >&2
    exit 1
  fi
done

jest_invocation() {
  local out_basename="$1"
  shift
  npm test --workspace=@cost-share/mobile -- \
    --passWithNoTests --ci "${IGNORE_ARGS[@]}" "$@" \
    --json --outputFile="${JEST_JSON_OUT}/${out_basename}"
}

echo "▶ Group ledger simulation (#641, blocking)"
npm test --workspace=@cost-share/mobile -- \
  --passWithNoTests --ci --testPathPattern=groupLedgerSimulation

echo "▶ Mobile Jest (blocking, ${#QUARANTINED[@]} quarantined)"
set +e
jest_invocation "run-1.json"
first_exit=$?
set -e

FLAKY_FILE="$ARTIFACT_DIR/flaky.json"
echo '[]' >"$FLAKY_FILE"

if [[ "$first_exit" -ne 0 ]]; then
  echo "▶ Retry failed tests once (flake detection)"
  set +e
  jest_invocation "run-2.json" --onlyFailures
  retry_exit=$?
  set -e

  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --slurpfile a "$ARTIFACT_DIR/run-1.json" \
      --slurpfile b "$ARTIFACT_DIR/run-2.json" '
      def failed_names($doc):
        [$doc.testResults[]? | . as $tr
          | ($tr.assertionResults[]? | select(.status == "failed") | ($tr.name + " › " + .title))
        ];
      def passed_names($doc):
        [$doc.testResults[]? | . as $tr
          | ($tr.assertionResults[]? | select(.status == "passed") | ($tr.name + " › " + .title))
        ];
      ($a[0]) as $run1 | ($b[0]) as $run2
      | (failed_names($run1) - passed_names($run2)) as $still_failing
      | (failed_names($run1) - $still_failing) as $flaky
      | { flaky: $flaky, still_failing: $still_failing }
    ' >"$ARTIFACT_DIR/flake-report.json" 2>/dev/null || true

    if [[ -f "$ARTIFACT_DIR/flake-report.json" ]]; then
      jq '.flaky' "$ARTIFACT_DIR/flake-report.json" >"$FLAKY_FILE"
      while IFS= read -r name; do
        [[ -z "$name" ]] && continue
        echo "::warning::Flaky test (passed on retry): $name"
      done < <(jq -r '.[]' "$FLAKY_FILE")
      still="$(jq -r '.still_failing | length' "$ARTIFACT_DIR/flake-report.json")"
      if [[ "$still" != "0" ]]; then
        jq -r '.still_failing[]' "$ARTIFACT_DIR/flake-report.json" | while read -r name; do
          echo "::error::Test failed after retry: $name"
        done
        exit 1
      fi
    fi
  fi

  if [[ "$retry_exit" -ne 0 ]]; then
    echo "::error::Mobile Jest failed after one retry" >&2
    exit 1
  fi
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Mobile Jest"
    echo "- Quarantined (manifest): ${#QUARANTINED[@]}"
    flaky_count="$(jq 'length' "$FLAKY_FILE")"
    echo "- Flaky (passed on retry): ${flaky_count}"
    if [[ "$flaky_count" != "0" ]]; then
      echo ""
      echo "**Flaky tests**"
      jq -r '.[] | "- `" + . + "`"' "$FLAKY_FILE"
    fi
  } >>"$GITHUB_STEP_SUMMARY"
fi

if [[ ${#QUARANTINED[@]} -gt 0 ]]; then
  echo "▶ Quarantined Jest files (non-blocking)"
  quarantine_fail=0
  for q in "${QUARANTINED[@]}"; do
    issue="$(jq -r --arg f "$q" '.[$f].issue // empty' "$QUARANTINE_FILE")"
    reason="$(jq -r --arg f "$q" '.[$f].reason // "quarantined"' "$QUARANTINE_FILE")"
    echo "▶ quarantine — ${q} (#${issue}: ${reason})"
    set +e
    npm test --workspace=@cost-share/mobile -- --passWithNoTests --ci --testPathPattern="$q"
    q_exit=$?
    set -e
    if [[ "$q_exit" -ne 0 ]]; then
      quarantine_fail=1
      echo "::warning::Quarantined test failed (non-blocking): $q — fix or track in #${issue}"
    fi
  done
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo ""
      echo "**Quarantined runs** (failures do not fail CI gate)"
      for q in "${QUARANTINED[@]}"; do
        issue="$(jq -r --arg f "$q" '.[$f].issue // empty' "$QUARANTINE_FILE")"
        echo "- \`$q\` (#${issue})"
      done
      if [[ "$quarantine_fail" -ne 0 ]]; then
        echo ""
        echo "_One or more quarantined files failed — see job log warnings._"
      fi
    } >>"$GITHUB_STEP_SUMMARY"
  fi
fi

echo "✅ Mobile Jest blocking suite passed"
