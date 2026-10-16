import { getProductAnalyticsContext } from '../productAnalyticsContext';

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { version: '9.9.9' } },
}));

jest.mock('../../i18n', () => ({
    __esModule: true,
    default: { language: 'he-IL' },
}));

describe('getProductAnalyticsContext', () => {
    it('returns platform, version, and short locale', () => {
        expect(getProductAnalyticsContext()).toEqual({
            platform: 'ios',
            appVersion: '9.9.9',
            locale: 'he',
        });
    });
});
