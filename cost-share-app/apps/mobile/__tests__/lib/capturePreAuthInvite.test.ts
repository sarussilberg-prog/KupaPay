import { inviteLinkFromUrl } from '../../lib/capturePreAuthInvite';

describe('inviteLinkFromUrl', () => {
    it.each([
        ['https://kupa-pay.com/g/AbCdEfGhIjKl', { kind: 'group', token: 'AbCdEfGhIjKl' }],
        [
            'com.kupapay.mobile://invite/i/AbCdEfGhIjKl',
            { kind: 'friend', token: 'AbCdEfGhIjKl' },
        ],
    ] as const)('parses %s', (url, expected) => {
        expect(inviteLinkFromUrl(url)).toEqual(expected);
    });

    it.each([
        'https://kupa-pay.com/g/AbCdEfGhIj',
        'com.kupapay.mobile://auth/callback#x',
        'https://kupa-pay.com/privacy',
    ])('ignores %s', (url) => {
        expect(inviteLinkFromUrl(url)).toBeNull();
    });
});
