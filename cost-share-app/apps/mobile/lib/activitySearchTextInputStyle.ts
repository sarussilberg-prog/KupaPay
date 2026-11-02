import { Platform, type TextStyle } from 'react-native';
import { isRtlLanguage, type Language } from '@cost-share/shared';
import { rtlTextAlign } from '../hooks/useRtlLayout';

/** Shared className for Activity feed search — alignment comes from style, not NativeWind text-* on TextInput. */
export const ACTIVITY_SEARCH_INPUT_CLASS = 'flex-1 text-sm text-gray-900 mx-2';

/**
 * iOS duplicates/garbles TextInput placeholders when `writingDirection` is set (RN bug).
 * Use textAlign only; bidi follows RtlLayoutProvider root direction.
 */
export function activitySearchTextInputStyle(
    language: Language,
    extra?: TextStyle,
): TextStyle {
    const isRtl = isRtlLanguage(language);
    const flat = extra ?? {};
    return {
        textAlign: flat.textAlign ?? rtlTextAlign(isRtl),
        ...(Platform.OS === 'android' && {
            includeFontPadding: false,
            textAlignVertical: 'center',
            paddingVertical: 0,
        }),
        ...flat,
    };
}

export function activitySearchTextInputResolvedProps(language: Language): {
    textAlign: 'left' | 'right';
    writingDirection: undefined;
} {
    const isRtl = isRtlLanguage(language);
    return {
        textAlign: rtlTextAlign(isRtl),
        writingDirection: undefined,
    };
}
