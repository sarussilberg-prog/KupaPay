#!/usr/bin/env node
/** Record last successful mobile CD build (path baseline + daily cap). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const platform = process.argv[2];
if (platform !== 'ios' && platform !== 'android') {
  console.error('Usage: record-mobile-cd-baseline.mjs <ios|android> [commitSha]');
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const baselinePath = path.join(repoRoot, 'cost-share-app/apps/mobile/mobile-cd-baseline.json');
const sha =
  process.argv[3]?.trim() ||
  process.env.MOBILE_CD_SHA?.trim() ||
  execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();

const today =
  process.env.JERUSALEM_DATE?.trim() ||
  execSync('TZ=Asia/Jerusalem date +%Y-%m-%d', { encoding: 'utf8' }).trim();

const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
data[platform] = {
  lastSuccessfulSha: sha,
  lastSuccessfulDateJerusalem: today,
};
fs.writeFileSync(baselinePath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Recorded mobile CD baseline ${platform}: ${sha.slice(0, 7)} on ${today}`);
