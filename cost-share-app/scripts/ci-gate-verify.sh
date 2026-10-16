#!/usr/bin/env bash
# Verify aggregated CI job outcomes (success or intentional skip).
set -euo pipefail

check() {
  local name=$1
  local result=$2
  if [[ "$result" == "success" || "$result" == "skipped" ]]; then
    echo "  ✓ $name ($result)"
    return 0
  fi
  echo "::error::Required check failed: $name ($result)"
  return 1
}

failed=0
while [[ $# -ge 2 ]]; do
  check "$1" "$2" || failed=1
  shift 2
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "✅ CI gate — all required checks passed or were intentionally skipped."
