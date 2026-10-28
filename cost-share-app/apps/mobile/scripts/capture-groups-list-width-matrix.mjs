#!/usr/bin/env node
/**
 * Capture groups list B2 preview at multiple viewport widths and locales.
 * Requires Expo web on BASE_URL (default http://127.0.0.1:8081).
 *
 * Usage: node scripts/capture-groups-list-width-matrix.mjs [outDir]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WIDTHS = [320, 360, 375, 390, 430, 768];
const LOCALES = process.env.GROUPS_LIST_CAPTURE_LOCALES?.split(',') ?? [
    'en',
    'he',
    'ar',
    'ru',
    'fr',
    'es',
    'de',
];
const BASE_URL = process.env.GROUPS_LIST_SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:8081';
const defaultOut = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../../../artifacts/groups-list-width-matrix',
);
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : defaultOut;

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
            const page = await context.newPage();
            const query = new URLSearchParams({
                devGroupsListB2Preview: '1',
                lang,
                theme: 'light',
                stress: '1',
                width: String(width),
            });
            const url = `${BASE_URL}/?${query.toString()}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
            await waitForPreview(page);
            const fileName = `groups-list-w${width}-${lang}.png`;
            const filePath = path.join(OUT_DIR, fileName);
            await page.screenshot({ path: filePath, fullPage: true });
            manifest.push({ width, lang, fileName, url });
            await page.close();
            console.log(`Saved ${filePath}`);
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
