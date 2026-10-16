import { GOOGLE_PLAY_OFFER_REDEEM_URL, googlePlayOfferRedeemUrl } from '../../lib/storeOfferRedemption';

describe('storeOfferRedemption', () => {
    it('uses the Play redeem URL for Android offer codes', () => {
        expect(googlePlayOfferRedeemUrl()).toBe(GOOGLE_PLAY_OFFER_REDEEM_URL);
        expect(GOOGLE_PLAY_OFFER_REDEEM_URL).toBe('https://play.google.com/redeem');
    });
});
