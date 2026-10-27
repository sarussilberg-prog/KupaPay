import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.join(__dirname, '../../i18n/locales');

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            keys.push(...flattenKeys(v as Record<string, unknown>, full));
        } else {
            keys.push(full);
        }
    }
    return keys;
}

function pluralSuffixKeys(keys: string[]): string[] {
    return keys.filter(k => k.endsWith('_two') || k.endsWith('_many'));
}

/**
 * KI-013: Hebrew defines _two/_many plural forms; English must mirror them for i18next.
 */
describe('en.json plural key parity vs he.json', () => {
    const heKeys = pluralSuffixKeys(
        flattenKeys(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'he.json'), 'utf8'))),
    );
    const enKeys = new Set(
        pluralSuffixKeys(
            flattenKeys(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'))),
        ),
    );

    it('includes every Hebrew _two/_many key in English', () => {
        const missing = heKeys.filter(k => !enKeys.has(k));
        expect(missing).toEqual([]);
    });
});
