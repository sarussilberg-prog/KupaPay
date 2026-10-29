import { useEffect } from 'react';
import { Platform } from 'react-native';
import { pushAndroidHardwareBackHandler } from '../lib/androidHardwareBackRegistry';

/**
 * Registers an Android hardware-back handler while `enabled` is true.
 * Handlers run before navigation pop / app exit guard (see useAppExitGuard).
 */
export function useAndroidHardwareBackHandler(enabled: boolean, onBack: () => void): void {
    useEffect(() => {
        if (Platform.OS !== 'android' || !enabled) {
            return undefined;
        }
        return pushAndroidHardwareBackHandler(() => {
            onBack();
            return true;
        });
    }, [enabled, onBack]);
}
