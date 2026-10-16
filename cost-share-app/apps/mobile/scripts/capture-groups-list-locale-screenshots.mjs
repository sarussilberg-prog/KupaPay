#!/usr/bin/env node
/**
 * Capture groups list B2 preview screenshots for all mobile locales (light + dark).
 * Requires Expo web on BASE_URL (default http://127.0.0.1:8081).
 *
 * Usage: node scripts/capture-groups-list-locale-screenshots.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const LOCALES = ['en', 'he', 'ar', 'de', 'es', 'fr', 'ru'];
const THEMES = ['light', 'dark'];
const BASE_URL = process.env.GROUPS_LIST_SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:8081';
const OUT_DIR =
    process.env.GROUPS_LIST_SCREENSHOT_OUT ??
    path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../artifacts/groups-list-locales');

async function waitForPreview(page) {
    await page.waitForSelector('[data-testid="groups-list-b2-preview-root"]', {
        timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="groups-list-title"]', { timeout: 60_000 });
    await page.waitForTimeout(800);
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 320, height: 780 },
        deviceScaleFactor: 2,
    });

    const manifest = [];

    for (const lang of LOCALES) {
        for (const theme of THEMES) {
            const page = await context.newPage();
            const query = new URLSearchParams({
                devGroupsListB2Preview: '1',
                lang,
                theme,
                narrow: '1',
                stress: '1',
            });
            const url = `${BASE_URL}/?${query.toString()}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
            await waitForPreview(page);
            const fileName = `groups-list-${lang}-${theme}.png`;
            const filePath = path.join(OUT_DIR, fileName);
            await page.screenshot({ path: filePath, fullPage: true });
            manifest.push({ lang, theme, fileName, url });
            await page.close();
            console.log(`Saved ${filePath}`);
        }
    }

    await browser.close();
    await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
