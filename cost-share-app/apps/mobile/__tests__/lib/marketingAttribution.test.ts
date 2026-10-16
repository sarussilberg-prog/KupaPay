import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    captureMarketingAttributionFromLaunchUrls,
    loadStoredMarketingAttribution,
} from '../../lib/marketingAttribution';
import { setProductAnalyticsClient } from '../../lib/productAnalytics';

describe('marketingAttribution', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        setProductAnalyticsClient(null);
    });

    it('persists first-touch UTM from launch URL', async () => {
        const capture = jest.fn();
        setProductAnalyticsClient({ capture, identify: jest.fn(), reset: jest.fn() });

        await captureMarketingAttributionFromLaunchUrls(
            'kupapay://invite?utm_source=twitter&utm_medium=social&utm_campaign=mauepic',
        );

        const stored = await loadStoredMarketingAttribution();
        expect(stored?.utmSource).toBe('twitter');
        expect(stored?.channel).toBe('twitter');
    });
});
