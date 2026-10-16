import { loadStaticLegalDocument, resolveLegalDocumentLocale } from '@cost-share/shared';
import { LEGAL_ENGLISH_PREVAILS_NOTE } from '@cost-share/shared';

describe('loadStaticLegalDocument', () => {
    it('loads English terms without prevails note', () => {
        const doc = loadStaticLegalDocument('terms', 'en');
        expect(doc).not.toBeNull();
        expect(doc!.title).toBe('Terms of Use');
        expect(doc!.content_md).not.toContain(LEGAL_ENGLISH_PREVAILS_NOTE.fr);
    });

    it('loads French privacy with prevails note and placeholders applied', () => {
        const doc = loadStaticLegalDocument('privacy', 'fr');
        expect(doc).not.toBeNull();
        expect(doc!.content_md).toContain(LEGAL_ENGLISH_PREVAILS_NOTE.fr);
        expect(doc!.content_md).toContain('sarussilberg@gmail.com');
    });

    it('falls back to English for unknown locale codes', () => {
        expect(resolveLegalDocumentLocale('xx')).toBe('en');
    });

    it('resolves Hebrew from region tag', () => {
        expect(resolveLegalDocumentLocale('he-IL')).toBe('he');
    });
});
