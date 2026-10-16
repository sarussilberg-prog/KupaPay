import { Linking, Platform } from 'react-native';
import {
    isIsraeliPaymentAppAvailable,
    isMobileWebUserAgent,
    openPaymentApp,
} from '../../lib/israeliPaymentLinks';

describe('israeliPaymentLinks', () => {
    const originalNavigator = global.navigator;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: originalNavigator,
        });
    });

    it('opens bit:// on native platforms', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        const canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

        await openPaymentApp('bit');

        expect(canOpenURL).toHaveBeenCalledWith('bit://');
        expect(openURL).toHaveBeenCalledWith('bit://');
    });

    it('tries paybox://pay before paybox://', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

        await openPaymentApp('paybox');

        expect(openURL).toHaveBeenCalledWith('paybox://pay');
    });

    it('falls back to the App Store when no deep link opens', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
        jest.spyOn(Linking, 'openURL')
            .mockRejectedValueOnce(new Error('fail'))
            .mockRejectedValueOnce(new Error('fail'))
            .mockRejectedValueOnce(new Error('fail'))
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce(undefined);

        await openPaymentApp('paybox');

        expect(Linking.openURL).toHaveBeenLastCalledWith('https://apps.apple.com/app/id895491053');
    });

    it('detects mobile web user agents', () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
        });

        expect(isMobileWebUserAgent()).toBe(true);
        expect(isIsraeliPaymentAppAvailable()).toBe(true);
    });

    it('hides payment apps on desktop web', () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        });

        expect(isMobileWebUserAgent()).toBe(false);
        expect(isIsraeliPaymentAppAvailable()).toBe(false);
    });

    it('opens Android intent then Play Store on mobile web when deep links fail', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' },
        });
        jest.spyOn(Linking, 'openURL')
            .mockRejectedValueOnce(new Error('fail'))
            .mockRejectedValueOnce(new Error('fail'))
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce(undefined);

        await openPaymentApp('bit');

        expect(Linking.openURL).toHaveBeenLastCalledWith(
            'https://play.google.com/store/apps/details?id=com.bnhp.payments.paymentsapp',
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
            expect.stringContaining('intent://pay#Intent;scheme=bit;package=com.bnhp.payments.paymentsapp'),
        );
    });
});
