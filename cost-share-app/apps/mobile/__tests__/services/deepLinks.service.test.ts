import { parseIncomingUrl } from '../../services/deepLinks.service';

describe('parseIncomingUrl', () => {
    it('parses https friend link', () => {
        expect(parseIncomingUrl('https://kupa-pay.com/i/AbC123def_12')).toEqual({
            kind: 'friend',
            token: 'AbC123def_12',
        });
    });
    it('parses https group link', () => {
        expect(parseIncomingUrl('https://kupa-pay.com/g/XYZ987654321')).toEqual({
            kind: 'group',
            token: 'XYZ987654321',
        });
    });
    it('parses custom-scheme friend link', () => {
        expect(parseIncomingUrl('com.kupapay.mobile://invite/i/ZZZ000011122')).toEqual({
            kind: 'friend',
            token: 'ZZZ000011122',
        });
    });
    it('parses custom-scheme group link', () => {
        expect(parseIncomingUrl('com.kupapay.mobile://invite/g/AAA111222333')).toEqual({
            kind: 'group',
            token: 'AAA111222333',
        });
    });
    it('returns unknown for unrelated URL', () => {
        expect(parseIncomingUrl('https://example.com/foo')).toEqual({ kind: 'unknown' });
    });
    it('returns unknown for malformed invite URL', () => {
        expect(parseIncomingUrl('https://kupa-pay.com/x/abc')).toEqual({ kind: 'unknown' });
    });
    it('rejects legacy 10-char tokens', () => {
        expect(parseIncomingUrl('https://kupa-pay.com/g/AbCdEfGhIj')).toEqual({ kind: 'unknown' });
    });
    it('handles trailing slash + query string', () => {
        expect(parseIncomingUrl('https://kupa-pay.com/g/AbCdEfGhIjKl?utm=foo')).toEqual({
            kind: 'group',
            token: 'AbCdEfGhIjKl',
        });
    });
});
