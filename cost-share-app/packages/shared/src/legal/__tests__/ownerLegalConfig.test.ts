import { applyLegalPlaceholders, OWNER_LEGAL_CONFIG } from '../ownerLegalConfig';
import { buildLegalPageUrl } from '../legalPageUrl';

describe('applyLegalPlaceholders', () => {
    it('replaces owner TODO tokens', () => {
        const md = 'Contact [SUPPORT EMAIL] at [ADDRESS] — [OWNER LEGAL NAME]';
        expect(applyLegalPlaceholders(md)).toContain(OWNER_LEGAL_CONFIG.supportEmail);
        expect(applyLegalPlaceholders(md)).toContain(OWNER_LEGAL_CONFIG.address);
        expect(applyLegalPlaceholders(md)).toContain(OWNER_LEGAL_CONFIG.ownerLegalName);
    });
});

describe('buildLegalPageUrl', () => {
    it('builds terms/privacy URLs with lang query', () => {
        expect(buildLegalPageUrl('https://kupa-pay.com/', 'privacy', 'he')).toBe(
            'https://kupa-pay.com/privacy?lang=he',
        );
        expect(buildLegalPageUrl('https://kupa-pay.com', 'terms', 'en')).toBe(
            'https://kupa-pay.com/terms?lang=en',
        );
    });
});
