import type { ViewStyle } from 'react-native';
import { listRowContainerStyle, ICON_LABEL_GAP } from '../ui/iconLabelLayout';

/** @deprecated Use listRowContainerStyle from components/ui/iconLabelLayout */
export function settingsRowContainerStyle(isRtl: boolean): ViewStyle {
    return listRowContainerStyle(isRtl, ICON_LABEL_GAP);
}
