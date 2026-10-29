import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../../../../../');
const captionsPath = path.join(repoRoot, 'store/asc/screenshot-captions.json');
const manifestPath = path.join(repoRoot, 'store/aso/locale-manifest.json');

describe('store screenshot captions (#409)', () => {
    it('covers all seven ASC locales and listing screens', () => {
        const { screens, captions } = JSON.parse(fs.readFileSync(captionsPath, 'utf8')) as {
            screens: string[];
            captions: Record<string, Record<string, string>>;
        };
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            ascLocaleByAppLocale: Record<string, string>;
        };
        const expectedAsc = Object.values(manifest.ascLocaleByAppLocale);
        expect(expectedAsc).toHaveLength(7);
        for (const ascLocale of expectedAsc) {
            expect(captions[ascLocale]).toBeDefined();
            for (const screen of screens) {
                const line = captions[ascLocale][screen];
                expect(typeof line).toBe('string');
                expect(line.trim().length).toBeGreaterThan(8);
            }
        }
    });
});
