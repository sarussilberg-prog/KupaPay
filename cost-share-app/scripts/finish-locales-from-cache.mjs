#!/usr/bin/env node
/** Apply translation cache onto en.json; untranslated strings stay English. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps/mobile/i18n/locales');
const CACHE_DIR = path.join(ROOT, 'scripts/.locale-translate-cache');
const LANGS = ['ru', 'ar', 'fr', 'es', 'de'];

function applyCache(obj, cache) {
  if (typeof obj === 'string') return cache[obj] ?? obj;
  if (Array.isArray(obj)) return obj.map((v) => applyCache(v, cache));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = applyCache(v, cache);
    return out;
  }
  return obj;
}

const base = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));

for (const lang of LANGS) {
  const cachePath = path.join(CACHE_DIR, `${lang}.json`);
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  const out = applyCache(base, cache);
  fs.writeFileSync(path.join(LOCALES_DIR, `${lang}.json`), `${JSON.stringify(out, null, 4)}\n`);
  console.log(lang, 'cache entries', Object.keys(cache).length);
}
