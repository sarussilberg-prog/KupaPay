import fs from 'fs';
import path from 'path';
import { SUPPORTED_LANGUAGES, verifyAllLegalLocales, type LegalSlug, type Language } from '@cost-share/shared';

const CONTENT_DIR = path.join(__dirname, '../../../../packages/shared/content/legal');

function readFile(slug: LegalSlug, locale: Language): string | null {
    const file = path.join(CONTENT_DIR, `${slug}.${locale}.md`);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

describe('legal markdown locale parity', () => {
    it('every supported language has terms and privacy markdown', () => {
        for (const locale of SUPPORTED_LANGUAGES) {
            expect(readFile('terms', locale)).toBeTruthy();
            expect(readFile('privacy', locale)).toBeTruthy();
        }
    });

    it('matches English section counts and placeholders', () => {
        const issues = verifyAllLegalLocales(readFile);
        expect(issues).toEqual([]);
    });
});
