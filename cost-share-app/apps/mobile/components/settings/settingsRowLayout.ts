import type { ViewStyle } from 'react-native';
import { rtlRowStyle } from '../../hooks/useRtlLayout';

/** Shared Settings list row layout — matches FeedRowCard / ActivityItemCard RTL spacing. */
export function settingsRowContainerStyle(isRtl: boolean): ViewStyle {
    return {
        alignItems: 'center',
        gap: 12,
        ...rtlRowStyle(isRtl),
    };
}
