import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useAndroidHardwareBackHandler } from '../../hooks/useAndroidHardwareBackHandler';
import {
    dispatchAndroidHardwareBack,
    resetAndroidHardwareBackRegistryForTests,
} from '../../lib/androidHardwareBackRegistry';

const originalPlatform = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

describe('useAndroidHardwareBackHandler', () => {
    afterEach(() => {
        setPlatform(originalPlatform);
        resetAndroidHardwareBackRegistryForTests();
    });

    it('registers on Android while enabled', () => {
        setPlatform('android');
        const onBack = jest.fn();
        renderHook(() => useAndroidHardwareBackHandler(true, onBack));

        expect(dispatchAndroidHardwareBack()).toBe(true);
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('does not register when disabled', () => {
        setPlatform('android');
        const onBack = jest.fn();
        renderHook(() => useAndroidHardwareBackHandler(false, onBack));

        expect(dispatchAndroidHardwareBack()).toBe(false);
        expect(onBack).not.toHaveBeenCalled();
    });

    it('is a no-op on iOS', () => {
        setPlatform('ios');
        const onBack = jest.fn();
        renderHook(() => useAndroidHardwareBackHandler(true, onBack));

        expect(dispatchAndroidHardwareBack()).toBe(false);
        expect(onBack).not.toHaveBeenCalled();
    });
});
