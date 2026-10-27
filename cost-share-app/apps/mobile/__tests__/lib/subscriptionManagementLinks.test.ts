import {
    defaultSubscriptionSku,
    googlePlaySubscriptionManagementUrl,
} from '../../lib/subscriptionManagementLinks';

describe('subscriptionManagementLinks', () => {
    it('builds Play subscription URL with sku and package', () => {
        const url = googlePlaySubscriptionManagementUrl('kupapay_pro_yearly', 'com.kupapay.mobile');
        expect(url).toContain('play.google.com/store/account/subscriptions');
        expect(url).toContain('sku=kupapay_pro_yearly');
        expect(url).toContain('package=com.kupapay.mobile');
    });

    it('picks default sku from plan kind', () => {
        expect(defaultSubscriptionSku('monthly')).toBe('kupapay_pro_monthly');
        expect(defaultSubscriptionSku('yearly')).toBe('kupapay_pro_yearly');
    });
});
