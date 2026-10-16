import { Platform, type ViewStyle } from 'react-native';
import { rtlRowStyle } from '../../hooks/useRtlLayout';
import { spacing } from '../../theme';

/** Fixed slot for leading icons in list / settings / menu rows. */
export const ICON_LABEL_BOX_WIDTH = 28;

export const ICON_LABEL_DEFAULT_ICON_SIZE = 22;

/** Gap between icon box and label — theme token, not ad-hoc margin classes. */
export const ICON_LABEL_GAP = spacing.md;

export type IconLabelDensity = 'default' | 'compact';

const COMPACT_BOX_WIDTH = 22;
const COMPACT_ICON_SIZE = 16;
const COMPACT_GAP = spacing.sm;

export function iconLabelMetrics(density: IconLabelDensity = 'default') {
    if (density === 'compact') {
        return {
            boxWidth: COMPACT_BOX_WIDTH,
            iconSize: COMPACT_ICON_SIZE,
            gap: COMPACT_GAP,
        };
    }
    return {
        boxWidth: ICON_LABEL_BOX_WIDTH,
        iconSize: ICON_LABEL_DEFAULT_ICON_SIZE,
        gap: ICON_LABEL_GAP,
    };
}

/** Horizontal row container for icon + label + optional trailing controls. */
export function listRowContainerStyle(
    isRtl: boolean,
    gap: number = ICON_LABEL_GAP,
    alignItems: 'center' | 'flex-start' = 'center',
): ViewStyle {
    const base = { alignItems, gap };
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
