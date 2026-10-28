#!/usr/bin/env bash
# Pack root node_modules for CI artifact upload (.bin symlinks preserved via tar+zstd).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

tar --use-compress-program='zstd -3 -T0' -cf node_modules.tar.zst node_modules
