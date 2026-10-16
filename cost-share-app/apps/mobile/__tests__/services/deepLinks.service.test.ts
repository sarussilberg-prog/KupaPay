import { parseIncomingUrl } from '../../services/deepLinks.service';

describe('parseIncomingUrl', () => {
    it.each([
        ['https://kupa-pay.com/i/AbC123def_12', { kind: 'friend', token: 'AbC123def_12' }],
        ['https://kupa-pay.com/g/XYZ987654321', { kind: 'group', token: 'XYZ987654321' }],
        ['com.kupapay.mobile://invite/i/ZZZ000011122', { kind: 'friend', token: 'ZZZ000011122' }],
        ['com.kupapay.mobile://invite/g/AAA111222333', { kind: 'group', token: 'AAA111222333' }],
        [
            'https://kupa-pay.com/g/AbCdEfGhIjKl?utm=foo',
            { kind: 'group', token: 'AbCdEfGhIjKl' },
        ],
    ] as const)('parses invite URL %s', (url, expected) => {
        expect(parseIncomingUrl(url)).toEqual(expected);
    });

    it.each([
        'https://example.com/foo',
        'https://kupa-pay.com/x/abc',
        'https://kupa-pay.com/g/AbCdEfGhIj',
    ])('returns unknown for %s', (url) => {
        expect(parseIncomingUrl(url)).toEqual({ kind: 'unknown' });
    });
});
