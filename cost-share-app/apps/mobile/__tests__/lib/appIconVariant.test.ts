import { Platform } from 'react-native';
import {
    IOS_LIQUID_GLASS_MIN_VERSION,
    shouldUseLiquidGlassAppIcon,
} from '../../lib/appIconVariant';

describe('appIconVariant', () => {
    const original = Platform.OS;
    const originalVersion = Platform.Version;

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
        Object.defineProperty(Platform, 'Version', { configurable: true, value: originalVersion });
    });

    it('uses glass logo only on iOS 26+', () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        Object.defineProperty(Platform, 'Version', { configurable: true, value: 25 });
        expect(shouldUseLiquidGlassAppIcon()).toBe(false);

        Object.defineProperty(Platform, 'Version', { configurable: true, value: 26 });
        expect(shouldUseLiquidGlassAppIcon()).toBe(true);

        Object.defineProperty(Platform, 'Version', { configurable: true, value: '26.1' });
        expect(shouldUseLiquidGlassAppIcon()).toBe(true);
    });

    it('never uses glass logo off iOS', () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        Object.defineProperty(Platform, 'Version', { configurable: true, value: 36 });
        expect(shouldUseLiquidGlassAppIcon()).toBe(false);
    });

    it('documents the minimum iOS major version', () => {
        expect(IOS_LIQUID_GLASS_MIN_VERSION).toBe(26);
    });
});
