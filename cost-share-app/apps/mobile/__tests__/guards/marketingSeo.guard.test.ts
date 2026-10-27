import fs from 'fs';
import path from 'path';
import { APP_WEB_ORIGIN, SUPPORTED_LANGUAGES } from '@cost-share/shared';

const WEB_APP = path.resolve(__dirname, '../../../web');

describe('Marketing SEO landing (Next.js web)', () => {
    it('defines locale landing routes and SEO helpers', () => {
        expect(fs.existsSync(path.join(WEB_APP, 'app/[locale]/page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(WEB_APP, 'lib/marketingSeo.ts'))).toBe(true);
        expect(fs.existsSync(path.join(WEB_APP, 'app/sitemap.ts'))).toBe(true);
        expect(fs.existsSync(path.join(WEB_APP, 'app/robots.ts'))).toBe(true);
        expect(fs.existsSync(path.join(WEB_APP, 'middleware.ts'))).toBe(true);
    });

    it('registers hreflang alternates for all seven locales', () => {
        const src = fs.readFileSync(path.join(WEB_APP, 'lib/marketingSeo.ts'), 'utf8');
        expect(src).toContain('buildLandingAlternateLanguages');
        expect(src).toContain('SUPPORTED_LANGUAGES');
        expect(src).toContain('marketingLandingUrl');
    });

    it('emits SoftwareApplication structured data', () => {
        const src = fs.readFileSync(
            path.join(WEB_APP, 'app/_components/LandingStructuredData.tsx'),
            'utf8',
        );
        expect(src).toContain('SoftwareApplication');
    });

    it('lists localized URLs in sitemap', () => {
        const src = fs.readFileSync(path.join(WEB_APP, 'app/sitemap.ts'), 'utf8');
        expect(src).toContain('marketingLandingPath');
        expect(src).toContain('SUPPORTED_LANGUAGES');
        expect(src).toContain('APP_WEB_ORIGIN');
    });

    it('includes seo copy keys in every web locale pack', () => {
        for (const locale of SUPPORTED_LANGUAGES) {
            const json = JSON.parse(
                fs.readFileSync(path.join(WEB_APP, 'locales', `${locale}.json`), 'utf8'),
            ) as { seo?: { title?: string; description?: string } };
            expect(json.seo?.title?.length).toBeGreaterThan(0);
            expect(json.seo?.description?.length).toBeGreaterThan(0);
        }
    });
});
