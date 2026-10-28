#!/usr/bin/env bash
# Shared helpers for Jest quarantine manifest (apps/mobile/__tests__/ci-quarantine.json).
set -euo pipefail

ci_jest_quarantine_file() {
  echo "apps/mobile/__tests__/ci-quarantine.json"
}

ci_jest_list_quarantined() {
  local file="${1:-$(ci_jest_quarantine_file)}"
  if [[ ! -f "$file" ]]; then
    echo "::error::missing $file" >&2
    return 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "::error::jq required for Jest quarantine manifest" >&2
    return 1
  fi
  jq -r 'keys[] | select(startswith("_") | not)' "$file" | sort
}

# Emits one --testPathIgnorePatterns <regex> pair per quarantined file (Jest CLI).
ci_jest_quarantine_ignore_args() {
  local file="${1:-$(ci_jest_quarantine_file)}"
  local entry
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    printf '%s\n' --testPathIgnorePatterns "$entry"
  done < <(ci_jest_list_quarantined "$file")
}

ci_jest_quarantine_count() {
  local file="${1:-$(ci_jest_quarantine_file)}"
  jq '[to_entries[] | select(.key != "_comment")] | length' "$file"
}
