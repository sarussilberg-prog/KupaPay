#!/usr/bin/env bash
# Fail when a migration creates a public table without enabling RLS in the same file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

shopt -s nullglob
files=(supabase/migrations/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no migration files found"
  exit 1
fi

fail=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file="${line%%|*}"
  table="${line#*|}"
  echo "::error::${file}: table public.${table} missing ENABLE ROW LEVEL SECURITY in same migration"
  fail=1
done < <(
  python3 <<'PY'
import re
from pathlib import Path

root = Path("supabase/migrations")
for path in sorted(root.glob("*.sql")):
    text = path.read_text()
    for m in re.finditer(
        r"CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)",
        text,
        re.I,
    ):
        table = m.group(1)
        if not re.search(
            rf"ALTER TABLE\s+(?:public\.)?{re.escape(table)}\s+ENABLE ROW LEVEL SECURITY",
            text,
            re.I,
        ):
            print(f"{path.name}|{table}")
PY
)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "✅ Migration RLS lint passed (${#files[@]} files)"
