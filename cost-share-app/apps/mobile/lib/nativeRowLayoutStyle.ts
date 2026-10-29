import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { rtlRowStyle } from '../hooks/useRtlLayout';

/** Flattened styles for native row layout regression checks (Yoga-like, no snapshot). */
export function flattenNativeRowStyles(
    ...styles: Array<ViewStyle | false | undefined | null>
): ViewStyle {
    return StyleSheet.flatten(styles.filter(Boolean) as ViewStyle[]) ?? {};
}

/**
 * Returns true when a horizontal flex row is safe on native New Architecture:
 * no `direction: 'rtl'` combined with flex growth on the same node.
 */
export function isNativeRowFlexSafe(style: ViewStyle, platform: typeof Platform.OS = Platform.OS): boolean {
    if (platform === 'web') return true;
    const flat = StyleSheet.flatten(style) ?? {};
    const direction = flat.direction;
    if (direction !== 'rtl') return true;
    const grows =
        flat.flex === 1 ||
        flat.flexGrow === 1 ||
        (typeof flat.flexGrow === 'number' && flat.flexGrow > 0);
    return !grows;
}

/** Expected outer row styles for full-width list cards on native. */
export function groupCardOuterRowStyle(isRtl: boolean, platform: typeof Platform.OS = Platform.OS): ViewStyle {
    return flattenNativeRowStyles(rtlRowStyle(isRtl), {
        width: '100%',
        alignSelf: 'stretch',
    });
}

export function listRowFlexStyle(isRtl: boolean, platform: typeof Platform.OS = Platform.OS): ViewStyle {
    return flattenNativeRowStyles(rtlRowStyle(isRtl), {
        flex: 1,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignSelf: 'stretch',
    });
}
