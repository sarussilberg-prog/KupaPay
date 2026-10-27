#!/usr/bin/env bash
# Non-blocking knip report for mobile + web (+ shared). Exit 0 always; findings go to stdout.
set -uo pipefail

cd "$(dirname "$0")/.."

echo "=== knip dead-code report (informational) ==="
set +e
npx knip --no-progress 2>&1 | tee /tmp/knip-report.txt
knip_exit=$?
set -e

if [[ "$knip_exit" -ne 0 ]]; then
  echo ""
  echo "::warning::knip reported unused exports, files, or dependencies (exit $knip_exit). See job log."
fi

exit 0
