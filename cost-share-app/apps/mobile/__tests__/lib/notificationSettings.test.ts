import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { openAppNotificationSettings } from '../../lib/notificationSettings';

jest.mock('expo-intent-launcher', () => ({
    ActivityAction: { APP_NOTIFICATION_SETTINGS: 'android.settings.APP_NOTIFICATION_SETTINGS' },
    startActivityAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-application', () => ({ applicationId: 'com.kupapay.app' }));

const mockStart = IntentLauncher.startActivityAsync as jest.MockedFunction<typeof IntentLauncher.startActivityAsync>;

describe('openAppNotificationSettings', () => {
    let openSettings: jest.SpyInstance;
    beforeEach(() => {
        mockStart.mockClear();
        mockStart.mockResolvedValue(undefined as any);
        openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any);
    });
    afterEach(() => {
        openSettings.mockRestore();
        Platform.OS = 'ios';
    });

    it('on Android deep-links to the app notification settings with the package extra', async () => {
        Platform.OS = 'android';
        await openAppNotificationSettings();
        expect(mockStart).toHaveBeenCalledWith(
            'android.settings.APP_NOTIFICATION_SETTINGS',
            { extra: { 'android.provider.extra.APP_PACKAGE': 'com.kupapay.app' } },
        );
        expect(openSettings).not.toHaveBeenCalled();
    });

    it('on iOS opens the app settings page', async () => {
        Platform.OS = 'ios';
        await openAppNotificationSettings();
        expect(openSettings).toHaveBeenCalledTimes(1);
        expect(mockStart).not.toHaveBeenCalled();
    });

    it('falls back to app settings when the Android intent throws', async () => {
        Platform.OS = 'android';
        mockStart.mockRejectedValueOnce(new Error('no activity'));
        await openAppNotificationSettings();
        expect(openSettings).toHaveBeenCalledTimes(1);
    });
});
