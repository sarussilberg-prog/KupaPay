#!/usr/bin/env node
/**
 * Capture light-mode en + he screenshots for the groups list preview on the current branch.
 * Requires Expo web at GROUPS_LIST_SCREENSHOT_BASE_URL (default http://127.0.0.1:8081).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SHOTS = [
    { lang: 'en', theme: 'light', suffix: 'en-light' },
    { lang: 'he', theme: 'light', suffix: 'he-rtl-light' },
];

const BASE_URL = process.env.GROUPS_LIST_SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:8081';
const OPTION_SLUG = process.env.GROUPS_LIST_OPTION_SLUG ?? 'option';
const OUT_DIR =
    process.env.GROUPS_LIST_SCREENSHOT_OUT ??
    path.resolve(
        fileURLToPath(new URL('.', import.meta.url)),
        '../../../../artifacts/groups-list-options',
        OPTION_SLUG,
    );

async function waitForPreview(page) {
    await page.waitForSelector('[data-testid="groups-list-b2-preview-root"]', {
        timeout: 120_000,
    });
    await page.waitForTimeout(900);
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
    });
    const manifest = [];

    for (const shot of SHOTS) {
        const page = await context.newPage();
        const query = new URLSearchParams({
            devGroupsListB2Preview: '1',
            lang: shot.lang,
            theme: shot.theme,
            stress: '1',
        });
        const url = `${BASE_URL}/?${query.toString()}`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
        await waitForPreview(page);
        const fileName = `groups-list-${OPTION_SLUG}-${shot.suffix}.png`;
        const filePath = path.join(OUT_DIR, fileName);
        await page.screenshot({ path: filePath, fullPage: true });
        manifest.push({ ...shot, fileName, url, filePath });
        await page.close();
        console.log(`Saved ${filePath}`);
    }

    await browser.close();
    await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
