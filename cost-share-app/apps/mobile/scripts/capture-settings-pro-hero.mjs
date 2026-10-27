#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serveExpoDist } from './playwright/serve-expo-dist.mjs';

const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(mobileDir, '../../..');
const require = createRequire(path.join(repoRoot, 'cost-share-app/package.json'));
const { chromium } = require('@playwright/test');

const outPath = process.argv[2] ?? '/opt/cursor/artifacts/settings-pro-he-hero.png';

const distDir = path.join(mobileDir, 'dist');
const port = 4174;

const server = await serveExpoDist(distDir, port);
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1320, height: 2868 } });
    const url = `http://127.0.0.1:${port}/?capture=1&screen=settings-pro&locale=he-IL&headline=KupaPay%20Pro`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForSelector('[data-testid="asc-capture-ready"]', { timeout: 120_000 });
    await page.waitForSelector('[data-testid="settings-manage-subscription"]', { timeout: 30_000 });
    await page.waitForTimeout(800);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Saved ${outPath} (${fs.statSync(outPath).size} bytes)`);
} finally {
    await browser.close();
    await server.close();
}
