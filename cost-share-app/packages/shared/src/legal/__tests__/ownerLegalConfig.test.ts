import { applyLegalPlaceholders, OWNER_LEGAL_CONFIG } from '../ownerLegalConfig';
import { buildLegalPageUrl } from '../legalPageUrl';

describe('applyLegalPlaceholders', () => {
    it('replaces owner tokens with English address by default', () => {
        const md = 'Contact [SUPPORT EMAIL] at [ADDRESS] — [OWNER LEGAL NAME]';
        expect(applyLegalPlaceholders(md)).toContain(OWNER_LEGAL_CONFIG.supportEmail);
        expect(applyLegalPlaceholders(md)).toContain(OWNER_LEGAL_CONFIG.address);
        expect(applyLegalPlaceholders(md)).toContain(OWNER_LEGAL_CONFIG.ownerLegalName);
    });

    it('uses Hebrew address for he locale', () => {
        const md = 'כתובת: [ADDRESS]';
        expect(applyLegalPlaceholders(md, 'he')).toContain(OWNER_LEGAL_CONFIG.addressHe);
        expect(applyLegalPlaceholders(md, 'he')).not.toContain('Shlomo HaMelech');
    });

    it('replaces Hebrew EU trader address token in terms', () => {
        const md = '[כתובת – נדרשת לפרטי הסוחר באיחוד]';
        expect(applyLegalPlaceholders(md, 'he')).toBe(OWNER_LEGAL_CONFIG.addressHe);
    });

    it('exposes operator identity fields', () => {
        expect(OWNER_LEGAL_CONFIG.legalResponsibleName).toBe('Nave Sarussi');
        expect(OWNER_LEGAL_CONFIG.operatorDisplayName).toBe('Sarussilberg');
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
        expect(buildLegalPageUrl('https://kupa-pay.com', 'privacy', 'fr')).toBe(
            'https://kupa-pay.com/privacy?lang=fr',
        );
    });
});
