#!/usr/bin/env node
/**
 * Capture App Store listing PNGs from Expo web export (real UI + listing frame).
 * Fails if any expected file is missing or nearly blank.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serveExpoDist } from './serve-expo-dist.mjs';

const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.join(mobileDir, '../../..');
const require = createRequire(path.join(repoRoot, 'cost-share-app/package.json'));
const { chromium } = require('@playwright/test');
const sharp = require('sharp');

const distDir = path.join(mobileDir, 'dist');
const iosOutRoot = path.join(repoRoot, 'store/screenshots/ios');
const androidOutRoot = path.join(repoRoot, 'store/screenshots/android');
const reviewDir = path.join(repoRoot, 'store/asc/review-screenshots');
const captions = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'store/asc/screenshot-captions.json'), 'utf8'),
);
const localeManifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'store/aso/locale-manifest.json'), 'utf8'),
);

const LISTING_SCREENS = captions.screens;
const ASC_LOCALES = (process.env.CAPTURE_ASC_LOCALES?.split(',').map((s) => s.trim()).filter(Boolean) ??
  Object.keys(captions.captions));
const IOS_SIZES = {
  '6.7': { width: 1290, height: 2796 },
  '6.5': { width: 1284, height: 2778 },
  '6.9': { width: 1320, height: 2868 },
  ipad: { width: 2048, height: 2732 },
};
const PLAY_PHONE = { width: 1080, height: 1920 };

function playLocaleForAsc(ascLocale) {
  const entry = Object.entries(localeManifest.ascLocaleByAppLocale ?? {}).find(
    ([, asc]) => asc === ascLocale,
  );
  return entry?.[0] ?? ascLocale.split('-')[0];
}

function assertDist() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Missing web export at ${distDir} — run expo export --platform web first`);
  }
}

async function assertScreenshotValid(pngPath, minBytes = 80_000) {
  const stat = fs.statSync(pngPath);
  if (stat.size < minBytes) {
    throw new Error(`Screenshot too small (${stat.size} B): ${pngPath}`);
  }
  const meta = await sharp(pngPath).metadata();
  if (!meta.width || !meta.height || meta.width < 1000) {
    throw new Error(`Unexpected screenshot dimensions: ${pngPath}`);
  }
}

async function captureAll() {
  assertDist();
  const port = 4173;
  const server = await serveExpoDist(distDir, port);
  const browser = await chromium.launch();
  const written = [];

  try {
    for (const ascLocale of ASC_LOCALES) {
      const playLocale = playLocaleForAsc(ascLocale);

      for (const screen of LISTING_SCREENS) {
        const headline =
          captions.captions[ascLocale]?.[screen] ?? captions.captions['en-US'][screen];

        for (const [sizeKey, dim] of Object.entries(IOS_SIZES)) {
          const outDir = path.join(iosOutRoot, ascLocale, sizeKey);
          fs.mkdirSync(outDir, { recursive: true });
          const outPath = path.join(outDir, `${screen}.png`);
          const page = await browser.newPage({ viewport: { width: dim.width, height: dim.height } });
          const url = `http://127.0.0.1:${port}/?capture=1&screen=${encodeURIComponent(screen)}&locale=${encodeURIComponent(ascLocale)}&headline=${encodeURIComponent(headline)}`;
          await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
          await page.waitForSelector('[data-testid="asc-capture-ready"]', { timeout: 120_000 });
          await page.waitForTimeout(600);
          await page.screenshot({ path: outPath, type: 'png' });
          await page.close();
          await assertScreenshotValid(outPath);
          written.push(outPath);
        }

        const androidDir = path.join(androidOutRoot, playLocale);
        fs.mkdirSync(androidDir, { recursive: true });
        const androidPath = path.join(androidDir, `${screen}.png`);
        const androidPage = await browser.newPage({
          viewport: { width: PLAY_PHONE.width, height: PLAY_PHONE.height },
        });
        const androidUrl = `http://127.0.0.1:${port}/?capture=1&screen=${encodeURIComponent(screen)}&locale=${encodeURIComponent(ascLocale)}&headline=${encodeURIComponent(headline)}`;
        await androidPage.goto(androidUrl, { waitUntil: 'networkidle', timeout: 120_000 });
        await androidPage.waitForSelector('[data-testid="asc-capture-ready"]', { timeout: 120_000 });
        await androidPage.waitForTimeout(600);
        await androidPage.screenshot({ path: androidPath, type: 'png' });
        await androidPage.close();
        await assertScreenshotValid(androidPath, 60_000);
        written.push(androidPath);
      }

      if (process.env.CAPTURE_SKIP_IAP_REVIEW === '1') {
        continue;
      }
      fs.mkdirSync(reviewDir, { recursive: true });
      const reviewPath = path.join(reviewDir, `paywall-${ascLocale}.png`);
      const paywallHeadline = captions.captions[ascLocale]?.['pro-currency'] ?? 'KupaPay Pro';
      const page = await browser.newPage({ viewport: { width: 1320, height: 2868 } });
      const url = `http://127.0.0.1:${port}/?capture=1&screen=pro-paywall&locale=${encodeURIComponent(ascLocale)}&headline=${encodeURIComponent(paywallHeadline)}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.waitForSelector('[data-testid="asc-demo-screen-pro-paywall"]', { timeout: 120_000 });
      await page.waitForTimeout(2000);
      const phone = page.locator('[data-testid="asc-capture-phone"]');
      await phone.screenshot({ path: reviewPath, type: 'png' });
      await page.close();
      await assertScreenshotValid(reviewPath, 40_000);
      written.push(reviewPath);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(JSON.stringify({ ok: true, count: written.length }, null, 2));
}

captureAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
