import {
    buildProductAnalyticsProperties,
    isProductAnalyticsFunnelEvent,
    PRODUCT_ANALYTICS_FUNNEL_EVENTS,
    productAnalyticsLibTag,
} from '../productAnalyticsEvents';

describe('productAnalyticsEvents', () => {
    it('lists all funnel events from issue #421', () => {
        expect([...PRODUCT_ANALYTICS_FUNNEL_EVENTS]).toEqual([
            'signup',
            'group_created',
            'expense_added',
            'invite_sent',
            'invite_accepted',
            'settle_up',
            'paywall_view',
            'trial_start',
        ]);
    });

    it('merges context tags without PII', () => {
        const props = buildProductAnalyticsProperties(
            { platform: 'ios', appVersion: '2.0.0', locale: 'he' },
            { group_id: 'g1' },
        );
        expect(props).toEqual({
            platform: 'ios',
            app_version: '2.0.0',
            locale: 'he',
            $lib: 'kupapay-ios',
            group_id: 'g1',
        });
        expect(JSON.stringify(props)).not.toMatch(/@|email|name/i);
    });

    it('recognizes funnel event names', () => {
        expect(isProductAnalyticsFunnelEvent('expense_added')).toBe(true);
        expect(isProductAnalyticsFunnelEvent('app_open')).toBe(false);
    });

    it('uses distinct lib tags per platform', () => {
        expect(productAnalyticsLibTag('web')).toBe('kupapay-web');
        expect(productAnalyticsLibTag('android')).toBe('kupapay-android');
    });
});
