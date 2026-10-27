/**
 * changeLanguage() must persist the same @app_language key used by initializeLanguage().
 */

jest.mock('expo-localization', () => ({
    getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

jest.mock('expo-updates', () => ({
    reloadAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    I18nManager: {
        allowRTL: jest.fn(),
        forceRTL: jest.fn(),
        isRTL: false,
    },
    DevSettings: {
        reload: jest.fn(),
    },
}));

import { DevSettings, I18nManager } from 'react-native';

const i18nMgr = I18nManager as unknown as {
    forceRTL: jest.Mock;
    isRTL: boolean;
};
const devReloadMock = DevSettings.reload as jest.Mock;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { changeLanguage, initializeLanguage } from '../../i18n';
import { useAppStore } from '../../store';

describe('changeLanguage', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        useAppStore.setState({ language: 'en' });
    });

    it('persists Hebrew to AsyncStorage and updates the store', async () => {
        await initializeLanguage();

        await changeLanguage('he');

        expect(await AsyncStorage.getItem('@app_language')).toBe('he');
        expect(useAppStore.getState().language).toBe('he');
    });

    it('persists English after switching from Hebrew', async () => {
        await AsyncStorage.setItem('@app_language', 'he');
        await initializeLanguage();

        await changeLanguage('en');

        expect(await AsyncStorage.getItem('@app_language')).toBe('en');
        expect(useAppStore.getState().language).toBe('en');
    });

    it('retries native RTL reload when applied flag is stale after Settings toggle', async () => {
        await AsyncStorage.multiSet([
            ['@app_language', 'he'],
            ['@rtl_native_applied', 'he'],
        ]);
        i18nMgr.isRTL = false;
        devReloadMock.mockClear();
        i18nMgr.forceRTL.mockClear();

        await changeLanguage('he');

        expect(i18nMgr.forceRTL).toHaveBeenCalledWith(true);
        expect(devReloadMock).toHaveBeenCalledTimes(1);
    });
});
