#!/usr/bin/env node
/** SVG marketing frames when simulator capture is unavailable. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const require = createRequire(path.join(repoRoot, "cost-share-app/package.json"));
const sharp = require("sharp");
const captions = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "store/asc/screenshot-captions.json"), "utf8"),
);
const rawDir = path.join(repoRoot, "store/screenshots/raw");
fs.mkdirSync(rawDir, { recursive: true });

for (const locale of Object.keys(captions.captions)) {
  for (const screen of captions.screens) {
    const title = captions.captions[locale][screen];
    const svg = `<svg width="1320" height="2708" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <rect x="60" y="120" width="1200" height="2468" rx="40" fill="#ffffff" stroke="#cbd5e1"/>
      <text x="660" y="280" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#0f172a">KupaPay</text>
      <text x="660" y="420" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#334155">${title.replace(/&/g, "&amp;")}</text>
      <text x="660" y="540" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#64748b">${screen}</text>
    </svg>`;
    const out = path.join(rawDir, `${locale}_${screen}.png`);
    await sharp(Buffer.from(svg)).png().toFile(out);
  }
}
console.log(`Fallback raw screenshots → ${rawDir}`);
