/**
 * Web dev: changeLanguage must not crash when DevSettings is undefined (Sentry COPAY-MOBILE-DEV-1A).
 */

jest.mock('expo-localization', () => ({
    getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

jest.mock('expo-updates', () => ({
    reloadAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'web' },
    I18nManager: {
        allowRTL: jest.fn(),
        forceRTL: jest.fn(),
        isRTL: false,
    },
    DevSettings: undefined,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { changeLanguage } from '../../i18n';

describe('syncNativeRtl on web', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    it('changeLanguage to Hebrew does not throw without DevSettings', async () => {
        await expect(changeLanguage('he')).resolves.toBeUndefined();
        expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    });
});
