import type { ViewStyle } from 'react-native';
import { listRowContainerStyle, ICON_LABEL_GAP } from '../ui/iconLabelLayout';
import { spacing } from '../../theme';

/** @deprecated Use listRowContainerStyle from components/ui/iconLabelLayout */
export function settingsRowContainerStyle(isRtl: boolean): ViewStyle {
    return listRowContainerStyle(isRtl, ICON_LABEL_GAP);
}

/** Compact gap between the fixed row label and its variable value (iOS/Android detail text). */
export const SETTINGS_VALUE_LABEL_GAP = spacing.sm;

/** Icon + label + value cluster for `SettingsRow` value variant — label stays leading, value follows. */
export function settingsRowValueClusterStyle(isRtl: boolean): ViewStyle {
    return {
        ...listRowContainerStyle(isRtl, SETTINGS_VALUE_LABEL_GAP),
        flexGrow: 0,
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '100%',
    };
}

export function settingsRowValueTextStyle(): ViewStyle {
    return {
        flexShrink: 1,
        minWidth: 0,
    };
}

/** Pushes the disclosure chevron to the trailing edge without separating label and value. */
export function settingsRowValueTrailingSpacerStyle(): ViewStyle {
    return {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: spacing.sm,
    };
}
