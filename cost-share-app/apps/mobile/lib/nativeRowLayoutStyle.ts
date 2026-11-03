import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { listRowContainerStyle } from '../components/ui/iconLabelLayout';
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

/** Card shell — block container (not a flex row). Row direction belongs on the inner ListRow only. */
export function groupCardShellStyle(_isRtl: boolean, platform: typeof Platform.OS = Platform.OS): ViewStyle {
    if (platform === 'web') {
        return { width: '100%', alignSelf: 'stretch' };
    }
    return {
        width: '100%',
        alignSelf: 'stretch',
        flexDirection: 'column',
        alignItems: 'stretch',
    };
}

/**
 * Inner horizontal row for GroupCard — full width, no flex growth on self.
 * Using listRowFlexStyle here collapses to ~content width on iOS New Architecture
 * when the shell is not a flex parent.
 */
export function groupCardInnerRowStyle(isRtl: boolean, platform: typeof Platform.OS = Platform.OS): ViewStyle {
    const sizing = {
        width: '100%' as const,
        alignSelf: 'stretch' as const,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto' as const,
        minWidth: 0,
        flexWrap: 'nowrap' as const,
    };
    // Reuse allowlisted list row flexDirection (Pressable ignores row styles on iOS New Arch — apply on inner View).
    if (platform !== 'web') {
        return { ...listRowContainerStyle(isRtl, 0), ...sizing };
    }
    return flattenNativeRowStyles(rtlRowStyle(isRtl), {
        ...sizing,
        alignItems: 'center',
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
