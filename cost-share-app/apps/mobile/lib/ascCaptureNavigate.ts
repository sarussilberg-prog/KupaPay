import type { AscCaptureScreen } from './ascCaptureParams';
import { CAPTURE_GROUP_BARCELONA } from '../screenshotDemo/ascCaptureSeed';
import { rootNavigationRef } from './rootNavigationRef';

/** Untyped root ref — same pattern as `navigate('X' as never)` elsewhere in the app. */
const navigateRoot = rootNavigationRef.navigate.bind(rootNavigationRef) as (
    name: string,
    params?: object,
) => void;

export function navigateAscCaptureScreen(screen: AscCaptureScreen): void {
    const groupId = CAPTURE_GROUP_BARCELONA;
    switch (screen) {
        case 'balances':
            navigateRoot('Main', {
                screen: 'Groups',
                params: { screen: 'Balances', params: { groupId } },
            });
            break;
        case 'pro-currency':
            navigateRoot('Main', {
                screen: 'Groups',
                params: {
                    screen: 'Balances',
                    params: { groupId, ascCaptureFocus: 'trip-currency' },
                },
            });
            break;
        case 'add-expense':
            navigateRoot('AddExpense', { groupId });
            break;
        case 'simplified-debts':
            navigateRoot('Main', {
                screen: 'Groups',
                params: { screen: 'SettleUpList', params: { groupId } },
            });
            break;
        case 'pro-paywall':
            navigateRoot('Paywall', { featureKey: 'store_capture', groupId });
            break;
        case 'settings-pro':
            navigateRoot('Settings');
            break;
        case 'groups':
        default:
            navigateRoot('Main', {
                screen: 'Groups',
                params: { screen: 'GroupsList' },
            });
    }
}
