/**
 * Capture Expo-web GroupCard list previews at phone width (430px WebFrame).
 *
 * Prereq: expo web running, e.g.
 *   cd apps/mobile && EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
 *
 * Usage:
 *   node apps/mobile/scripts/capture-group-card-screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outDir =
    process.env.SCREENSHOT_OUT ?? '/opt/cursor/artifacts/screenshots/groups-list-balance';
const baseUrl = process.env.EXPO_WEB_URL ?? 'http://127.0.0.1:8081';
const locales = ['en', 'he', 'ar', 'ru'];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: 430, height: 920 },
});

for (const lang of locales) {
    const url = `${baseUrl}/?devGroupCardPreview=1&lang=${lang}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForSelector('[data-testid="group-card-preview-root"]', { timeout: 120_000 });
    await page.waitForSelector('[data-testid="group-card-preview-lang"]', { timeout: 60_000 });
    await page.waitForSelector('[data-testid="balance-chip-amount"]', { timeout: 60_000 });
    await page.waitForTimeout(400);
    const frame = page.locator('[data-testid="group-card-preview-frame"]');
    await frame.screenshot({
        path: join(outDir, `${lang}-group-card-list.png`),
    });
    console.log(`Saved ${lang}-group-card-list.png`);
}

await browser.close();
