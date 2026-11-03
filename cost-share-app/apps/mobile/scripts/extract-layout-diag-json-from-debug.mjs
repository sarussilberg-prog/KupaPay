#!/usr/bin/env node
/**
 * Pull [LAYOUT_DIAG_JSON] payload from Maestro iOS hierarchy dumps when console.log is absent.
 */
import fs from 'node:fs';
import path from 'node:path';

const debugDir = process.argv[2];
const dest = process.argv[3];
if (!debugDir || !dest) {
  process.exit(0);
}
if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
  process.exit(0);
}

function findPayload(node) {
  if (!node || typeof node !== 'object') return null;
  const attrs = node.attributes;
  if (attrs?.['resource-id'] === 'groups-layout-diagnostics-json' && attrs.accessibilityText) {
    const text = attrs.accessibilityText;
    if (text.startsWith('{') && text.includes('"checks"')) return text;
  }
  for (const child of node.children ?? []) {
    const found = findPayload(child);
    if (found) return found;
  }
  return null;
}

function scanFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.includes('groups-layout-diagnostics-json')) return null;
  try {
    return findPayload(JSON.parse(raw));
  } catch {
    const match = raw.match(
      /"accessibilityText"\s*:\s*"(\{\\"locale\\".*?)"\s*,\s*\n\s*"resource-id"\s*:\s*"groups-layout-diagnostics-json"/s,
    );
    if (!match) return null;
    try {
      return JSON.parse(`"${match[1].replace(/\\/g, '\\\\')}"`.replace(/\\\\"/g, '\\"'));
    } catch {
      return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }
}

if (!fs.existsSync(debugDir)) process.exit(0);

const files = fs
  .readdirSync(debugDir)
  .filter(
    (f) =>
      f.includes('groups-layout-diagnostic') ||
      f.endsWith('-hierarchy.txt') ||
      f.includes('hierarchy'),
  )
  .map((f) => path.join(debugDir, f));

for (const file of files) {
  const payload = scanFile(file);
  if (payload) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, payload);
    process.exit(0);
  }
}
