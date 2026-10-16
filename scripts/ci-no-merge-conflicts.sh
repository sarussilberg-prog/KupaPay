#!/usr/bin/env bash
# Fail if git merge conflict markers are committed (breaks YAML and other parsers).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

mapfile -t hits < <(
  git grep -n -E '^<<<<<<< |^>>>>>>> |^=======$' -- \
    ':!node_modules' \
    ':!**/node_modules/**' \
    ':!**/package-lock.json' \
    ':!**/deno.lock' \
    2>/dev/null || true
)

if [[ ${#hits[@]} -gt 0 ]]; then
  echo "::error::Merge conflict marker(s) found in the repository:"
  printf '  %s\n' "${hits[@]}"
  exit 1
fi

echo "✅ No merge conflict markers in tracked files."
