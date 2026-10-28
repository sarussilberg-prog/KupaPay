#!/usr/bin/env node
/**
 * Capture groups list B2 preview screenshots for mobile locales.
 * Requires Expo web on BASE_URL (default http://127.0.0.1:8081).
 *
 * Usage:
 *   node scripts/capture-groups-list-locale-screenshots.mjs
 *   GROUPS_LIST_CAPTURE_WIDTHS=320,360,375,390,430,768 node scripts/capture-groups-list-locale-screenshots.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const LOCALES = (process.env.GROUPS_LIST_CAPTURE_LOCALES ?? 'en,he,ar,de,es,fr,ru').split(',');
const THEMES = (process.env.GROUPS_LIST_CAPTURE_THEMES ?? 'light,dark').split(',');
const WIDTHS = (process.env.GROUPS_LIST_CAPTURE_WIDTHS ?? '320')
    .split(',')
    .map(w => Number.parseInt(w.trim(), 10))
    .filter(n => Number.isFinite(n));
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
    const manifest = [];

    for (const width of WIDTHS) {
        const context = await browser.newContext({
            viewport: { width, height: 780 },
            deviceScaleFactor: 2,
        });

        for (const lang of LOCALES) {
            for (const theme of THEMES) {
                const page = await context.newPage();
                const query = new URLSearchParams({
                    devGroupsListB2Preview: '1',
                    lang,
                    theme,
                    narrow: '1',
                    stress: '1',
                    width: String(width),
                });
                const url = `${BASE_URL}/?${query.toString()}`;
                await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
                await waitForPreview(page);
                const fileName =
                    WIDTHS.length > 1
                        ? `groups-list-w${width}-${lang}-${theme}.png`
                        : `groups-list-${lang}-${theme}.png`;
                const filePath = path.join(OUT_DIR, fileName);
                await page.screenshot({ path: filePath, fullPage: true });
                manifest.push({ width, lang, theme, fileName, url });
                await page.close();
                console.log(`Saved ${filePath}`);
            }
        }

        await context.close();
    }

    await browser.close();
    await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
