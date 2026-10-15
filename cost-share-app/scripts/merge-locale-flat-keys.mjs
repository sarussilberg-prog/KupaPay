#!/usr/bin/env node
/** Merge flat dot-key strings into nested locale JSON files. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../apps/mobile/i18n/locales');

function setNested(obj, dotKey, value) {
  const parts = dotKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

const patchPath = process.argv[2];
const patches = JSON.parse(fs.readFileSync(patchPath, 'utf8'));

for (const [lang, flat] of Object.entries(patches)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(flat)) {
    setNested(locale, key, value);
  }
  fs.writeFileSync(file, `${JSON.stringify(locale, null, 4)}\n`);
  console.log(lang, Object.keys(flat).length, 'keys merged');
}
