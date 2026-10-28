#!/usr/bin/env bash
# Pack root + workspace node_modules for CI artifact upload (npm workspaces hoist some deps locally).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

paths=(node_modules)
while IFS= read -r d; do
  paths+=("$d")
done < <(find apps packages -maxdepth 2 -name node_modules -type d 2>/dev/null | sort -u)

tar --use-compress-program='zstd -3 -T0' -cf node_modules.tar.zst "${paths[@]}"
