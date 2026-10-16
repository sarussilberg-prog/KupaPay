#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
const versionPath = path.join(repoRoot, 'cost-share-app/packages/shared/version.json');

// Compiled shared sources are not required — duplicate minimal parser for the script runtime.
const SECTION_HEADING_RE = /^## \[([^\]]+)\]\s*(?:—|-)\s*(.+)$/;

function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const line of lines) {
    const heading = SECTION_HEADING_RE.exec(line.trim());
    if (heading) {
      if (current) entries.push(current);
      current = { version: heading[1].trim(), bullets: [] };
      continue;
    }
    if (!current) continue;
    const bullet = /^-\s+(.+)$/.exec(line.trim());
    if (bullet) current.bullets.push(bullet[1].trim());
  }
  if (current) entries.push(current);
  return entries;
}

function devIndex(version) {
  const m = /^(\d+\.\d+\.\d+)-dev\.(\d+)$/.exec(version.trim());
  return m ? Number(m[2]) : null;
}

function entriesSince(markdown, sinceVersion) {
  const sinceIdx = devIndex(sinceVersion);
  const all = parseSections(markdown);
  if (sinceIdx === null) return all.filter(e => e.version !== sinceVersion);
  return all.filter(e => {
    const idx = devIndex(e.version);
    return idx !== null && idx > sinceIdx;
  });
}

function formatNotes(entries, maxChars = 4000) {
  const lines = [];
  for (const entry of entries) {
    lines.push(entry.version);
    for (const b of entry.bullets) lines.push(`• ${b}`);
    lines.push('');
  }
  const text = lines.join('\n').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

const versionJson = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const since = versionJson.lastTestFlightInternalVersion?.trim() || versionJson.version;
const markdown = fs.readFileSync(changelogPath, 'utf8');
const entries = entriesSince(markdown, since);
const notes =
  entries.length > 0
    ? formatNotes(entries)
    : `Build ${versionJson.version}\n\nNo changelog entries since ${since}.`;

process.stdout.write(notes);
