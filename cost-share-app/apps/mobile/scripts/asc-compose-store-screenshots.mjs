#!/usr/bin/env node
/**
 * Resize Maestro/raw captures, add caption band, write store/screenshots/ios/<locale>/<size>/.
 */
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
const rawDir = process.argv[2] ?? path.join(repoRoot, "store/screenshots/raw");
const outRoot = path.join(repoRoot, "store/screenshots/ios");

const sizes = {
  "6.9": { width: 1320, height: 2868 },
  "6.5": { width: 1284, height: 2778 },
  ipad: { width: 2048, height: 2732 },
};

async function compose(filePath, locale, screenKey, sizeKey) {
  const { width, height } = sizes[sizeKey];
  const caption = captions.captions[locale]?.[screenKey] ?? captions.captions["en-US"][screenKey];
  const captionBand = 160;
  const imgH = height - captionBand;
  const resized = await sharp(filePath).resize(width, imgH, { fit: "cover" }).png().toBuffer();
  const svg = `<svg width="${width}" height="${captionBand}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f172a"/>
    <text x="50%" y="55%" font-family="Helvetica, Arial, sans-serif" font-size="42" font-weight="600" fill="#ffffff" text-anchor="middle">${caption.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
  </svg>`;
  const band = await sharp(Buffer.from(svg)).png().toBuffer();
  const outDir = path.join(outRoot, locale, sizeKey);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${screenKey}.png`);
  await sharp({ create: { width, height, channels: 3, background: "#0f172a" } })
    .composite([
      { input: resized, top: 0, left: 0 },
      { input: band, top: imgH, left: 0 },
    ])
    .png()
    .toFile(outPath);
  return outPath;
}

if (!fs.existsSync(rawDir)) {
  console.error(`Missing raw screenshot dir: ${rawDir}`);
  process.exit(1);
}

const written = [];
for (const file of fs.readdirSync(rawDir).filter((f) => f.endsWith(".png"))) {
  const base = file.replace(/\.png$/, "");
  const [locale, ...rest] = base.split("_");
  const screenKey = rest.join("_");
  if (!locale || !screenKey) continue;
  const full = path.join(rawDir, file);
  for (const sizeKey of Object.keys(sizes)) {
    written.push(await compose(full, locale, screenKey, sizeKey));
  }
}

console.log(JSON.stringify({ ok: true, count: written.length, written }, null, 2));
