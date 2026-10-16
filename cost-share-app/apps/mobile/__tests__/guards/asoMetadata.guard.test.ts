import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const ASO_ROOT = path.join(REPO_ROOT, 'store/aso');
const PLAY_ROOT = path.join(REPO_ROOT, 'store/play');
const LOCALES = ['en', 'he', 'ru', 'ar', 'fr', 'es', 'de'] as const;

describe('ASO metadata (prepare-only repo copies)', () => {
    it('documents prepare-only policy', () => {
        const readme = fs.readFileSync(path.join(ASO_ROOT, 'README.md'), 'utf8');
        expect(readme).toMatch(/Prepare only/i);
        expect(readme).toMatch(/do \*\*not\*\* submit/i);
    });

    it('maps app locales to ASC locale codes', () => {
        const manifest = JSON.parse(
            fs.readFileSync(path.join(ASO_ROOT, 'locale-manifest.json'), 'utf8'),
        ) as { appLocales: string[]; ascLocaleByAppLocale: Record<string, string> };
        expect(manifest.appLocales.sort()).toEqual([...LOCALES].sort());
        for (const locale of LOCALES) {
            expect(manifest.ascLocaleByAppLocale[locale]?.length).toBeGreaterThan(0);
        }
    });

    it('includes iOS title, subtitle, and keywords per locale', () => {
        for (const locale of LOCALES) {
            const base = path.join(ASO_ROOT, 'ios', locale);
            for (const file of ['title.txt', 'subtitle.txt', 'keywords.txt'] as const) {
                const p = path.join(base, file);
                expect(fs.existsSync(p)).toBe(true);
                const text = fs.readFileSync(p, 'utf8').trim();
                expect(text.length).toBeGreaterThan(0);
                if (file === 'title.txt') expect(text.length).toBeLessThanOrEqual(30);
                if (file === 'subtitle.txt') expect(text.length).toBeLessThanOrEqual(30);
                if (file === 'keywords.txt') expect(text.length).toBeLessThanOrEqual(100);
            }
        }
    });

    it('tracks keyword baselines in CSV', () => {
        const csv = fs.readFileSync(path.join(ASO_ROOT, 'keyword-rankings.csv'), 'utf8');
        expect(csv).toContain('baseline_rank');
        for (const locale of LOCALES) {
            expect(csv).toContain(`${locale},`);
        }
    });

    it('links Play listing copy under store/play', () => {
        for (const locale of LOCALES) {
            const base = path.join(PLAY_ROOT, locale);
            expect(fs.existsSync(path.join(base, 'title.txt'))).toBe(true);
            expect(fs.existsSync(path.join(base, 'short_description.txt'))).toBe(true);
            expect(fs.existsSync(path.join(base, 'full_description.txt'))).toBe(true);
        }
    });
});
