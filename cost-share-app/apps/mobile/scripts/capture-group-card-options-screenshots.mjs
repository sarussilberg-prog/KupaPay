/**
 * Capture group card design options (A/B/C) — en + he, light + dark.
 *
 * Prereq: Expo web on EXPO_WEB_URL (default http://127.0.0.1:8081), or static dist via build:web + serve.
 *
 * Usage:
 *   node apps/mobile/scripts/capture-group-card-options-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outDir =
    process.env.SCREENSHOT_OUT ?? '/opt/cursor/artifacts/screenshots/group-card-options';
const baseUrl = process.env.EXPO_WEB_URL ?? 'http://127.0.0.1:8081';
const options = ['a', 'b', 'c'];
const langs = ['en', 'he'];
const themes = ['light', 'dark'];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: 430, height: 920 },
    deviceScaleFactor: 2,
});

const manifest = [];

for (const option of options) {
    for (const lang of langs) {
        for (const theme of themes) {
            const query = new URLSearchParams({
                devGroupCardOptionsPreview: '1',
                option,
                lang,
                theme,
                stress: '1',
            });
            const url = `${baseUrl}/?${query.toString()}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 180_000 });
            await page.waitForSelector('[data-testid="group-card-options-preview-root"]', {
                timeout: 180_000,
            });
            await page.waitForSelector('[data-testid="group-card-meta"]', { timeout: 60_000 });
            await page.waitForSelector('[data-testid="group-card-options-preview-label"]', {
                timeout: 60_000,
            });
            await page.waitForTimeout(800);
            const fileName = `group-card-option-${option}-${lang}-${theme}.png`;
            const filePath = join(outDir, fileName);
            const frame = page.locator('[data-testid="group-card-options-preview-frame"]');
            await frame.screenshot({ path: filePath });
            manifest.push({ option, lang, theme, fileName, url });
            console.log(`Saved ${fileName}`);
        }
    }
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
