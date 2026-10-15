#!/usr/bin/env node
/**
 * Generate locale JSON from en.json using @vitalets/google-translate-api (unofficial).
 * Cache: scripts/.locale-translate-cache/<lang>.json — failures are NOT cached.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translate } from '@vitalets/google-translate-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps/mobile/i18n/locales');
const CACHE_DIR = path.join(ROOT, 'scripts/.locale-translate-cache');

const TARGETS = {
  ru: 'ru',
  ar: 'ar',
  fr: 'fr',
  es: 'es',
  de: 'de',
};

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;
const DELAY_MS = 900;

function protectPlaceholders(text) {
  const tokens = [];
  const protectedText = text.replace(PLACEHOLDER_RE, (m) => {
    tokens.push(m);
    return `__PH${tokens.length - 1}__`;
  });
  return { protectedText, tokens };
}

function restorePlaceholders(text, tokens) {
  let out = text;
  tokens.forEach((tok, i) => {
    out = out.split(`__PH${i}__`).join(tok);
  });
  return out;
}

function loadCache(lang) {
  const p = path.join(CACHE_DIR, `${lang}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  return {};
}

function saveCache(lang, cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${lang}.json`), JSON.stringify(cache, null, 2));
}

function shouldSkip(text) {
  if (!text?.trim()) return true;
  if (text.startsWith('http://') || text.startsWith('https://')) return true;
  return false;
}

async function translateString(text, target, cache) {
  if (cache[text]) return cache[text];
  if (shouldSkip(text)) {
    cache[text] = text;
    return text;
  }
  const { protectedText, tokens } = protectPlaceholders(text);
  let attempt = 0;
  while (attempt < 8) {
    try {
      const res = await translate(protectedText, { from: 'en', to: target });
      const out = restorePlaceholders(res.text, tokens);
      cache[text] = out;
      await new Promise((r) => setTimeout(r, DELAY_MS));
      return out;
    } catch (e) {
      attempt += 1;
      const wait = Math.min(120_000, 2000 * 2 ** attempt);
      console.error(`retry ${attempt} in ${wait}ms`, text.slice(0, 40), e.message);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  console.error('skip (no cache)', text.slice(0, 60));
  return text;
}

async function walk(obj, target, cache) {
  if (typeof obj === 'string') return translateString(obj, target, cache);
  if (Array.isArray(obj)) {
    const out = [];
    for (const item of obj) out.push(await walk(item, target, cache));
    return out;
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = await walk(v, target, cache);
      if (Object.keys(cache).length % 20 === 0) saveCache(target, cache);
    }
    return out;
  }
  return obj;
}

async function main() {
  const langs = process.argv.slice(2);
  const toRun = langs.length ? langs : Object.keys(TARGETS);
  const base = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));

  for (const lang of toRun) {
    const target = TARGETS[lang];
    if (!target) {
      console.error('Unknown', lang);
      process.exit(1);
    }
    const cache = loadCache(lang);
    console.log(`[${lang}] starting, cache ${Object.keys(cache).length}`);
    const translated = await walk(base, target, cache);
    saveCache(lang, cache);
    fs.writeFileSync(
      path.join(LOCALES_DIR, `${lang}.json`),
      `${JSON.stringify(translated, null, 4)}\n`,
    );
    console.log(`[${lang}] done, cache ${Object.keys(cache).length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
