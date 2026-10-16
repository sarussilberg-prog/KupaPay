import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatMoney } from '../packages/shared/src/i18n/formatMoney';

const out = process.env.SCREENSHOT_OUT ?? '/opt/cursor/artifacts/screenshots/groups-list-balance';
mkdirSync(out, { recursive: true });

const locales = [
    { code: 'en', dir: 'ltr', owe: 'You owe', owed: 'Owed to you', more: '+2 currencies' },
    { code: 'he', dir: 'rtl', owe: 'את/ה חייב/ת', owed: 'מגיע לך', more: '+2 מטבעות' },
    { code: 'ar', dir: 'rtl', owe: 'أنت مدين', owed: 'مستحق لك', more: '+2 عملات' },
    { code: 'ru', dir: 'ltr', owe: 'Вы должны', owed: 'Вам должны', more: '+2 валют' },
];

for (const loc of locales) {
    const oweAmt = formatMoney(761.5, 'ILS', {
        language: loc.code,
        absolute: true,
        bidiIsolate: false,
    });
    const owedAmt = formatMoney(138.75, 'USD', {
        language: loc.code,
        absolute: true,
        bidiIsolate: false,
    });
    const rows = [
        { text: `${loc.owe} ${oweAmt}`, sub: loc.more, color: '#dc2626' },
        { text: `${loc.owed} ${owedAmt}`, sub: loc.more, color: '#047857' },
    ];
    const svgRows = rows
        .map((row, index) => {
            const y = 48 + index * 112;
            return `<rect x="16" y="${y}" width="358" height="96" rx="16" fill="${index === 0 ? '#fef2f2' : '#ecfdf5'}" stroke="#e2e8f0"/>
<text x="32" y="${y + 36}" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" fill="${row.color}" direction="${loc.dir}">${escape(row.text)}</text>
<text x="32" y="${y + 62}" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#64748b" direction="${loc.dir}">${escape(row.sub)}</text>`;
        })
        .join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="390" height="280">
  <rect width="390" height="280" fill="#f8fafc"/>
  <text x="16" y="24" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#64748b">${loc.code.toUpperCase()} — GroupCard balance chip</text>
  ${svgRows}
</svg>`;
    writeFileSync(join(out, `${loc.code}-group-card-balance.svg`), svg);
}

function escape(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

console.log(`Wrote SVG previews to ${out}`);
