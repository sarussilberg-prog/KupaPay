#!/usr/bin/env bash
# Unpack node_modules from the setup job artifact (tar+zstd preserves .bin symlinks).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f node_modules.tar.zst ]]; then
  tar --use-compress-program=zstd -xf node_modules.tar.zst
  rm -f node_modules.tar.zst
fi

if [[ ! -d node_modules ]]; then
  echo "::error::Missing node_modules after artifact restore — Install dependencies job may have failed or artifact layout changed." >&2
  exit 1
fi
