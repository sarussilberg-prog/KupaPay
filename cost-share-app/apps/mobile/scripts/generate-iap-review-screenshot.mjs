#!/usr/bin/env node
/**
 * Render paywall review PNGs for ASC subscription review (all locales).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const require = createRequire(path.join(repoRoot, "cost-share-app/package.json"));
const sharp = require("sharp");
const meta = JSON.parse(fs.readFileSync(path.join(repoRoot, "store/asc/iap-metadata.json"), "utf8"));
const outDir = path.join(repoRoot, "store/asc/review-screenshots");
fs.mkdirSync(outDir, { recursive: true });

const prices = { monthly: "₪12.90", yearly: "₪69.90", trip: "₪19.90" };

const paywallCopy = {
  "en-US": {
    title: "KupaPay Pro",
    f1: "No ads",
    f2: "Auto trip currency",
    f3: "PDF reports",
    yearlyNote: "Includes 1 Trip Pass while subscribed",
    trip: `Trip Pass — ${prices.trip} · 30 days, no renewal`,
  },
  he: {
    title: "KupaPay Pro",
    f1: "בלי פרסומות",
    f2: "המרת מטבע לטיול",
    f3: "דוח PDF לקבוצה",
    yearlyNote: "כולל Trip Pass אחד כל עוד המנוי פעיל",
    trip: `Trip Pass — ${prices.trip} · 30 יום, בלי חידוש`,
  },
  ru: {
    title: "KupaPay Pro",
    f1: "Без рекламы",
    f2: "Валюта поездки",
    f3: "PDF-отчёты",
    yearlyNote: "1 Trip Pass на время подписки",
    trip: `Trip Pass — ${prices.trip} · 30 дней`,
  },
  "ar-SA": {
    title: "KupaPay Pro",
    f1: "بدون إعلانات",
    f2: "عملات الرحلة",
    f3: "تقارير PDF",
    yearlyNote: "Trip Pass واحد مع الاشتراك",
    trip: `Trip Pass — ${prices.trip}`,
  },
  "fr-FR": {
    title: "KupaPay Pro",
    f1: "Sans publicité",
    f2: "Devises voyage",
    f3: "Rapports PDF",
    yearlyNote: "1 Trip Pass tant que l'abonnement est actif",
    trip: `Trip Pass — ${prices.trip}`,
  },
  "es-ES": {
    title: "KupaPay Pro",
    f1: "Sin anuncios",
    f2: "Divisas de viaje",
    f3: "Informes PDF",
    yearlyNote: "1 Trip Pass mientras estés suscrito",
    trip: `Trip Pass — ${prices.trip}`,
  },
  "de-DE": {
    title: "KupaPay Pro",
    f1: "Keine Werbung",
    f2: "Reise-Währung",
    f3: "PDF-Berichte",
    yearlyNote: "1 Trip Pass solange Abo aktiv",
    trip: `Trip Pass — ${prices.trip}`,
  },
};

function svgForLocale(locale, copy) {
  const rtl = locale === "he" || locale === "ar-SA";
  const anchor = rtl ? "end" : "start";
  const xTitle = rtl ? 1180 : 140;
  const xBody = rtl ? 1180 : 140;
  return `<svg width="1320" height="2868" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="80" y="220" width="1160" height="2420" rx="48" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="${xTitle}" y="360" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#0f172a" text-anchor="${anchor}">${copy.title}</text>
  <text x="${xBody}" y="480" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#334155" text-anchor="${anchor}">• ${copy.f1}</text>
  <text x="${xBody}" y="540" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#334155" text-anchor="${anchor}">• ${copy.f2}</text>
  <text x="${xBody}" y="600" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#334155" text-anchor="${anchor}">• ${copy.f3}</text>
  <rect x="140" y="720" width="1040" height="120" rx="24" fill="#eff6ff" stroke="#3b82f6"/>
  <text x="${xBody}" y="795" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="600" fill="#1d4ed8" text-anchor="${anchor}">Monthly ${prices.monthly}</text>
  <rect x="140" y="880" width="1040" height="120" rx="24" fill="#dbeafe" stroke="#2563eb"/>
  <text x="${xBody}" y="955" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#1e40af" text-anchor="${anchor}">Yearly ${prices.yearly}</text>
  <text x="${xBody}" y="1040" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#475569" text-anchor="${anchor}">${copy.yearlyNote}</text>
  <rect x="140" y="1100" width="1040" height="120" rx="24" fill="#f1f5f9" stroke="#64748b"/>
  <text x="${xBody}" y="1175" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#334155" text-anchor="${anchor}">${copy.trip}</text>
  <text x="660" y="1350" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Restore Purchases · Terms · Privacy</text>
</svg>`;
}

for (const locale of meta.ascLocales) {
  const copy = paywallCopy[locale] ?? paywallCopy["en-US"];
  const svg = svgForLocale(locale, copy);
  const out = path.join(outDir, `paywall-${locale}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`Wrote ${out}`);
}
