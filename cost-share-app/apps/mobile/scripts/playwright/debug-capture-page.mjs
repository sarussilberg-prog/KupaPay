#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createRequire } from 'node:module';

const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.join(mobileDir, '../../..');
const require = createRequire(path.join(repoRoot, 'cost-share-app/package.json'));
const { chromium } = require('@playwright/test');

const distDir = path.join(mobileDir, 'dist');
const port = 4173;

const server = await new Promise((resolve, reject) => {
  const s = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const file = path.join(distDir, rel);
    if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200);
    fs.createReadStream(file).pipe(res);
  });
  s.on('error', reject);
  s.listen(port, '127.0.0.1', () => resolve(s));
});

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('console:', m.type(), m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));

await page.goto(`http://127.0.0.1:${port}/?capture=1&screen=groups&locale=en-US&headline=Test`, {
  waitUntil: 'networkidle',
  timeout: 120000,
});
await page.waitForTimeout(5000);
const html = await page.content();
console.log('has capture ready', html.includes('asc-capture-ready'));
console.log('has demo loading', html.includes('asc-demo-loading'));
await page.screenshot({ path: '/opt/cursor/artifacts/debug-capture.png', fullPage: true });
await browser.close();
server.close();
