import type { AscCaptureScreen } from './ascCaptureParams';
import { CAPTURE_GROUP_BARCELONA } from '../screenshotDemo/ascCaptureSeed';
import { rootNavigationRef } from './rootNavigationRef';

export const ASC_CAPTURE_PHONE = { width: 430, height: 932 } as const;
export const ASC_CAPTURE_ANDROID_PHONE = { width: 360, height: 640 } as const;

export function ascCaptureReadySelector(screen: AscCaptureScreen): string {
    switch (screen) {
        case 'groups':
            return '[data-testid="groups-list-virtualized"]';
        case 'balances':
            return '[data-testid="balances-screen-root"]';
        case 'pro-currency':
            return '[data-testid="group-trip-currency-section"]';
        case 'add-expense':
            return '[data-testid="amount-display"]';
        case 'simplified-debts':
            return '[data-testid="settle-up-list-screen"]';
        case 'pro-paywall':
            return '[data-testid="asc-demo-screen-pro-paywall"]';
        case 'settings-pro':
            return '[data-testid="asc-demo-screen-settings-pro"]';
        default:
            return '[data-testid="groups-list-virtualized"]';
    }
}

export function navigateAscCaptureScreen(screen: AscCaptureScreen): void {
    const groupId = CAPTURE_GROUP_BARCELONA;
    switch (screen) {
        case 'groups':
            rootNavigationRef.navigate('Main', {
                screen: 'Groups',
                params: { screen: 'GroupsList' },
            });
            break;
        case 'balances':
            rootNavigationRef.navigate('Main', {
                screen: 'Groups',
                params: { screen: 'Balances', params: { groupId } },
            });
            break;
        case 'pro-currency':
            rootNavigationRef.navigate('Main', {
                screen: 'Groups',
                params: {
                    screen: 'Balances',
                    params: { groupId, ascCaptureFocus: 'trip-currency' },
                },
            });
            break;
        case 'add-expense':
            rootNavigationRef.navigate('AddExpense', { groupId });
            break;
        case 'simplified-debts':
            rootNavigationRef.navigate('Main', {
                screen: 'Groups',
                params: { screen: 'SettleUpList', params: { groupId } },
            });
            break;
        case 'pro-paywall':
            rootNavigationRef.navigate('Paywall', { featureKey: 'store_capture', groupId });
            break;
        case 'settings-pro':
            rootNavigationRef.navigate('Settings');
            break;
        default:
            rootNavigationRef.navigate('Main', {
                screen: 'Groups',
                params: { screen: 'GroupsList' },
            });
    }
}
