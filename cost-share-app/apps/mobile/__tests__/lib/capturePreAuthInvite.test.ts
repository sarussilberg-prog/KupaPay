import { inviteLinkFromUrl } from '../../lib/capturePreAuthInvite';

describe('inviteLinkFromUrl', () => {
    it('parses group invite HTTPS URLs', () => {
        expect(
            inviteLinkFromUrl('https://kupa-pay.com/g/AbCdEfGhIjKl'),
        ).toEqual({ kind: 'group', token: 'AbCdEfGhIjKl' });
    });

    it('parses friend invite custom scheme URLs', () => {
        expect(
            inviteLinkFromUrl('com.kupapay.mobile://invite/i/AbCdEfGhIjKl'),
        ).toEqual({ kind: 'friend', token: 'AbCdEfGhIjKl' });
    });

    it('ignores legacy 10-char tokens', () => {
        expect(inviteLinkFromUrl('https://kupa-pay.com/g/AbCdEfGhIj')).toBeNull();
    });

    it('ignores auth callbacks and unknown paths', () => {
        expect(inviteLinkFromUrl('com.kupapay.mobile://auth/callback#x')).toBeNull();
        expect(inviteLinkFromUrl('https://kupa-pay.com/privacy')).toBeNull();
    });
});
