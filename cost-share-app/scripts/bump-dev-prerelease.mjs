#!/usr/bin/env node
/**
 * After a dev merge: bump packages/shared/version.json (-dev.N), append CHANGELOG.md.
 * Commit message includes [skip ci] so Vercel ignoreCommand skips an extra deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const versionFile = path.join(repoRoot, 'cost-share-app/packages/shared/version.json');
const changelogFile = path.join(repoRoot, 'CHANGELOG.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function stripDev(version) {
  const m = /^(\d+\.\d+\.\d+)(?:-dev\.\d+)?$/.exec(String(version).trim());
  return m ? m[1] : String(version).trim();
}

function bumpDev(current, marketingVersion) {
  const devMatch = /^(\d+\.\d+\.\d+)-dev\.(\d+)$/.exec(String(current).trim());
  if (devMatch) {
    return `${devMatch[1]}-dev.${Number(devMatch[2]) + 1}`;
  }
  const marketing = marketingVersion?.trim() || stripDev(current);
  return `${marketing}-dev.1`;
}

function appendChangelog({ version, prTitle, prNumber }) {
  const date = new Date().toISOString().slice(0, 10);
  const bullet = prNumber ? `- ${prTitle} (#${prNumber})` : `- ${prTitle}`;
  const block = `\n## [${version}] — ${date}\n${bullet}\n`;
  if (!fs.existsSync(changelogFile)) {
    fs.writeFileSync(changelogFile, `# Changelog\n${block}`);
    return;
  }
  const existing = fs.readFileSync(changelogFile, 'utf8');
  fs.writeFileSync(changelogFile, existing.trimEnd() + block);
}

const prTitle = process.env.PR_TITLE?.trim() || 'Dev merge';
const prNumber = process.env.PR_NUMBER?.trim() || '';

const data = readJson(versionFile);
const current = data.version;
const marketingVersion = data.marketingVersion?.trim() || stripDev(current);
const next = bumpDev(current, marketingVersion);

data.version = next;
data.marketingVersion = marketingVersion;
if (!data.lastTestFlightInternalVersion) {
  data.lastTestFlightInternalVersion = current;
}

writeJson(versionFile, data);
appendChangelog({ version: next, prTitle, prNumber });

console.log(`Bumped ${current} → ${next}`);
