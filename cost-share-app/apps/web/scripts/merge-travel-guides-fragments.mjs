#!/usr/bin/env node
/**
 * Merges locales/fragments/travelGuides.{locale}.json into apps/web/locales/{locale}.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, '..');
const localesDir = path.join(webRoot, 'locales');
const fragmentsDir = path.join(localesDir, 'fragments');

const LOCALES = ['en', 'he', 'ru', 'ar', 'fr', 'es', 'de'];

for (const locale of LOCALES) {
    const fragmentPath = path.join(fragmentsDir, `travelGuides.${locale}.json`);
    if (!fs.existsSync(fragmentPath)) {
        console.error(`Missing fragment: ${fragmentPath}`);
        process.exitCode = 1;
        continue;
    }
    const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf8'));
    const localePath = path.join(localesDir, `${locale}.json`);
    const localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    localeData.footer = { ...localeData.footer, travelGuides: fragment.footerTravelGuides };
    localeData.travelGuides = fragment.travelGuides;
    fs.writeFileSync(localePath, `${JSON.stringify(localeData, null, 2)}\n`);
    console.log(`Merged travel guides into ${locale}.json`);
}

if (process.exitCode) {
    process.exit(process.exitCode);
}
