import { Platform, type ViewStyle } from 'react-native';
import { rtlRowStyle } from '../../hooks/useRtlLayout';

/** Shared Settings list row layout — matches GroupCard / LegalDocumentSheet RTL spacing. */
export function settingsRowContainerStyle(isRtl: boolean): ViewStyle {
    const base = { alignItems: 'center' as const, gap: 12 };
    // iOS native: `direction` alone does not mirror flex children until I18nManager
    // reloads; use explicit row-reverse (see FeedItemDetailSheet / GroupCard).
    if (Platform.OS !== 'web') {
        return {
            ...base,
            flexDirection: isRtl ? 'row-reverse' : 'row',
        };
    }
    return {
        ...base,
        ...rtlRowStyle(isRtl),
    };
}
