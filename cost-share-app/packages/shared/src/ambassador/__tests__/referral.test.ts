import {
    buildAmbassadorReferralUrl,
    normalizeAmbassadorReferralCode,
    parseAmbassadorRefFromUrl,
} from '../referral';

describe('ambassador referral helpers', () => {
    it('normalizes valid codes', () => {
        expect(normalizeAmbassadorReferralCode('amb-abc123')).toBe('AMB-ABC123');
        expect(normalizeAmbassadorReferralCode('bad')).toBeNull();
    });

    it('parses ref from URL', () => {
        expect(parseAmbassadorRefFromUrl('https://kupa-pay.com/en?ref=AMB-ABC123')).toBe('AMB-ABC123');
    });

    it('builds marketing URL with ref param', () => {
        expect(buildAmbassadorReferralUrl('AMB-XYZ789', 'he')).toBe(
            'https://kupa-pay.com/he?ref=AMB-XYZ789',
        );
    });
});
