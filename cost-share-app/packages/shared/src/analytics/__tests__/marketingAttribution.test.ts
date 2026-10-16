import {
    marketingAttributionToPostHogProperties,
    parseMarketingAttributionFromUrl,
} from '../marketingAttribution';

describe('marketingAttribution', () => {
    it('parses UTM params from a marketing URL', () => {
        const attr = parseMarketingAttributionFromUrl(
            'https://kupapay.app/?utm_source=newsletter&utm_medium=email&utm_campaign=launch',
        );
        expect(attr).toMatchObject({
            channel: 'newsletter',
            utmSource: 'newsletter',
            utmMedium: 'email',
            utmCampaign: 'launch',
        });
    });

    it('parses Apple Search Ads pt/ct as campaign', () => {
        const attr = parseMarketingAttributionFromUrl('kupapay://open?pt=123&ct=summer');
        expect(attr?.channel).toBe('apple_search_ads');
        expect(attr?.appleSearchAdsCampaign).toBe('123:summer');
    });

    it('maps to PostHog person properties', () => {
        const props = marketingAttributionToPostHogProperties({
            channel: 'google',
            utmSource: 'google',
            utmMedium: 'cpc',
        });
        expect(props.acquisition_channel).toBe('google');
        expect(props.utm_source).toBe('google');
    });
});
