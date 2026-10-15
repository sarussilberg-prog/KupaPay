import { inviteLinkFromUrl } from '../../lib/capturePreAuthInvite';

describe('inviteLinkFromUrl', () => {
    it('parses group invite HTTPS URLs', () => {
        expect(
            inviteLinkFromUrl('https://kupa-pay.com/g/AbCdEfGhIj'),
        ).toEqual({ kind: 'group', token: 'AbCdEfGhIj' });
    });

    it('parses friend invite custom scheme URLs', () => {
        expect(
            inviteLinkFromUrl('com.kupapay.mobile://invite/i/AbCdEfGhIj'),
        ).toEqual({ kind: 'friend', token: 'AbCdEfGhIj' });
    });

    it('ignores auth callbacks and unknown paths', () => {
        expect(inviteLinkFromUrl('com.kupapay.mobile://auth/callback#x')).toBeNull();
        expect(inviteLinkFromUrl('https://kupa-pay.com/privacy')).toBeNull();
    });
});
