import { Platform } from 'react-native';
import { isAscScreenshotDemo } from './ascScreenshotDemo';

export type AscCaptureScreen =
    | 'groups'
    | 'balances'
    | 'add-expense'
    | 'simplified-debts'
    | 'pro-currency'
    | 'pro-paywall'
    | 'settings-pro';

export function readAscCaptureParams(): { screen: AscCaptureScreen; locale: string } | null {
    if (!isAscScreenshotDemo()) return null;
    const fromEnv = process.env.EXPO_PUBLIC_SCREENSHOT_LOCALE?.trim();
    const fromEnvScreen = process.env.EXPO_PUBLIC_SCREENSHOT_SCREEN?.trim() as AscCaptureScreen | undefined;
    if (Platform.OS !== 'web' || typeof globalThis.location === 'undefined') {
        if (fromEnvScreen && fromEnv) {
            return { screen: fromEnvScreen, locale: fromEnv };
        }
        return { screen: 'groups', locale: fromEnv ?? 'en-US' };
    }
    const params = new URLSearchParams(globalThis.location.search);
    const screen = (params.get('screen') ?? fromEnvScreen ?? 'groups') as AscCaptureScreen;
    const locale = params.get('locale') ?? fromEnv ?? 'en-US';
    return { screen, locale };
}
