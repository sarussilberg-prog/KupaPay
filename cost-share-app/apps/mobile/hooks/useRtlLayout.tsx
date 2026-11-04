import React, { createContext, useContext } from 'react';
import { I18nManager, Platform, StyleProp, TextStyle, View, ViewStyle, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isLanguage, isRtlLanguage, type Language } from '@cost-share/shared';
import { useAppStore } from '../store';

const RtlLayoutContext = createContext<boolean | null>(null);

/** App UI language — prefers Zustand store over i18n (kept in sync on language change). */
export function useAppLanguage(): Language {
    const language = useAppStore((s) => s.language);
    if (isLanguage(language)) return language;

    const { i18n } = useTranslation();
    const code = i18n.language.split('-')[0];
    return isLanguage(code) ? code : 'en';
}

/** True when UI should mirror for RTL languages — driven by app language, not device locale. */
export function useRtlLayout(): boolean {
    const fromContext = useContext(RtlLayoutContext);
    if (fromContext !== null) return fromContext;

    const language = useAppStore((s) => s.language);
    if (isLanguage(language)) return isRtlLanguage(language);

    const { i18n } = useTranslation();
    const code = i18n.language.split('-')[0];
    return isLanguage(code) ? isRtlLanguage(code) : false;
}

/**
 * True when native I18nManager RTL matches app language (post-reload steady state).
 * While false, layout may use row-reverse until syncNativeRtl reload completes.
 */
export function isNativeRtlSynced(isRtl: boolean): boolean {
    if (Platform.OS === 'web') return true;
    return I18nManager.isRTL === isRtl;
}

/**
 * Horizontal flex row — single canonical row style for list/card/toolbar rows.
 *
 * Native (iOS/Android): rely on I18nManager mirroring for `flexDirection: 'row'`.
 * Never set `direction: 'ltr'` on rows — that disables mirroring while I18nManager.isRTL
 * is true (#732: avatar left / menu right in Hebrew). Avoid `direction: 'rtl'` on flex
 * rows with flex-growing children (New Architecture shrink bug); keep direction on the
 * app root (web) or inherit the global I18nManager swap without per-row overrides.
 *
 * Pre-reload mismatch (Settings language change before reload): temporary row-reverse.
 */
export function rtlRowStyle(isRtl: boolean): ViewStyle {
    if (Platform.OS === 'web') {
        return { flexDirection: 'row' };
    }
    if (isNativeRtlSynced(isRtl)) {
        return { flexDirection: 'row' };
    }
    // App language and I18nManager disagree — mirror manually until reload.
    return { flexDirection: 'row-reverse' };
}

/** App shell — web sets CSS direction; native uses I18nManager only (no direction prop). */
export function rtlRootStyle(isRtl: boolean): ViewStyle {
    if (Platform.OS === 'web') {
        return {
            flex: 1,
            direction: isRtl ? 'rtl' : 'ltr',
        };
    }
    return { flex: 1 };
}

/** Chevron / forward navigation icons — flip by app language, not device locale. */
export function rtlForwardChevronIcon(isRtl: boolean): 'chevron-forward' | 'chevron-back' {
    return isRtl ? 'chevron-back' : 'chevron-forward';
}

/**
 * Currency symbol + amount rows stay visually LTR under Hebrew UI.
 * Native RTL mirroring is cancelled with row-reverse when synced.
 */
export function ltrAmountRowStyle(isRtl: boolean): ViewStyle {
    if (Platform.OS === 'web') {
        return { flexDirection: 'row', direction: 'ltr' };
    }
    if (isRtl && isNativeRtlSynced(isRtl)) {
        return { flexDirection: 'row-reverse' };
    }
    return { flexDirection: 'row' };
}

/** Narrow column wrapper for tabular amounts in feed/settlement rows. */
export function ltrAmountColumnStyle(isRtl: boolean): ViewStyle {
    if (Platform.OS === 'web') {
        return { direction: 'ltr' };
    }
    if (isRtl && isNativeRtlSynced(isRtl)) {
        return { flexDirection: 'row-reverse' };
    }
    return {};
}

export const ltrNumericTextStyle: TextStyle = {
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
};

/** Physical left alignment for LTR amount cells (canonical — do not inline elsewhere). */
export const ltrAmountCellTextAlign = 'left' as const;

/** Opts AppText out of auto stretch on amount symbol glyphs (baseline rows). */
export function ltrAmountSymbolTextStyle(): TextStyle {
    return {
        ...ltrNumericTextStyle,
        textAlign: 'left',
    };
}

/** Symmetric logo merge animation must not mirror with language (web only). */
export function brandMarkAnimationWrapperStyle(): ViewStyle {
    if (Platform.OS === 'web') {
        return { direction: 'ltr' };
    }
    return {};
}

/** Markdown / rich text blocks on web need explicit CSS direction. */
export function rtlMarkdownContainerStyle(isRtl: boolean): ViewStyle {
    if (Platform.OS === 'web') {
        return { direction: isRtl ? 'rtl' : 'ltr' };
    }
    return {};
}

/**
 * Physical `textAlign` that renders on the layout-start edge.
 * Under `I18nManager.forceRTL`, RN mirrors `left`/`right` — never use `isRtl ? 'right'` on native.
 */
export function rtlTextAlign(isRtl: boolean): 'left' | 'right' {
    if (Platform.OS === 'web') {
        return isRtl ? 'right' : 'left';
    }
    if (!isRtl) {
        return 'left';
    }
    return isNativeRtlSynced(isRtl) ? 'left' : 'right';
}

export function rtlWritingDirection(isRtl: boolean): 'rtl' | 'ltr' {
    return isRtl ? 'rtl' : 'ltr';
}

export function rtlTrailingAlign(isRtl: boolean): 'flex-start' | 'flex-end' {
    return isRtl ? 'flex-start' : 'flex-end';
}

/** Column wrapper so start-aligned text hugs the logical start edge in RTL/LTR. */
export const startEdgeColumnStyle: ViewStyle = {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
};

/** Reliable center alignment in LTR and RTL (className text-center alone is insufficient on native). */
export const centeredTextStyle: TextStyle = {
    width: '100%',
    textAlign: 'center',
    alignSelf: 'stretch',
};

function hasExplicitTextAlign(className?: string, style?: StyleProp<TextStyle>): boolean {
    if (
        className?.includes('text-center') ||
        className?.includes('text-left') ||
        className?.includes('text-right')
    ) {
        return true;
    }

    return Boolean(StyleSheet.flatten(style)?.textAlign);
}

/** NativeWind className wins over the style prop — keep alignment in className on native. */
export function rtlTextClassName(isRtl: boolean, className?: string, style?: StyleProp<TextStyle>): string {
    if (hasExplicitTextAlign(className, style)) return '';

    const align = isRtl ? 'text-right' : 'text-left';
    return Platform.OS === 'web' ? align : `${align} self-stretch`;
}

/** Applies bidi direction unless the caller set textAlign explicitly in style. */
export function resolveAutoTextStyle(
    isRtl: boolean,
    className?: string,
    style?: StyleProp<TextStyle>,
): TextStyle | undefined {
    if (StyleSheet.flatten(style)?.textAlign) return undefined;

    return {
        writingDirection: rtlWritingDirection(isRtl),
    };
}

/**
 * User-facing or mixed-script copy (names, URLs, amounts) — layout-start edge follows
 * app language, not the text's natural script (unlike `textAlign: 'auto'`).
 */
export function appLanguageEdgeTextStyle(
    isRtl: boolean,
    className?: string,
    style?: StyleProp<TextStyle>,
): TextStyle {
    const flat = StyleSheet.flatten(style);
    if (flat?.textAlign) {
        return {
            writingDirection: rtlWritingDirection(isRtl),
            ...flat,
        } as TextStyle;
    }
    return {
        textAlign: rtlTextAlign(isRtl),
        writingDirection: rtlWritingDirection(isRtl),
        ...(flat ?? {}),
    };
}

/** Static i18n-only copy (strings match app language) — `textAlign: 'auto'` under native RTL. */
export function startEdgeTextStyle(
    isRtl: boolean,
    className?: string,
    style?: StyleProp<TextStyle>,
): TextStyle {
    const flat = StyleSheet.flatten(style);
    if (flat?.textAlign) {
        return {
            ...(resolveAutoTextStyle(isRtl, className, style) ?? {}),
            ...flat,
        } as TextStyle;
    }
    return {
        ...(resolveAutoTextStyle(isRtl, className) ?? {}),
        textAlign: 'auto',
        ...(flat ?? {}),
    };
}

/** Feed actor label — edge-aligned by app language, not by name script. */
export function feedActorNameStyle(isRtl: boolean): TextStyle {
    return {
        ...appLanguageEdgeTextStyle(isRtl),
        alignSelf: 'stretch',
    };
}

export function resolveAutoTextInputStyle(
    isRtl: boolean,
    style?: StyleProp<TextStyle>,
): TextStyle | undefined {
    const flat = StyleSheet.flatten(style);
    if (flat?.textAlign) return undefined;

    // textAlign ONLY — deliberately no `writingDirection`. On iOS a TextInput
    // with `writingDirection` set renders its placeholder twice (overlapping,
    // garbled — a long-standing RN bug). Base bidi direction is already
    // established by the RtlLayoutProvider root (`direction: rtl/ltr`), so the
    // input still lays mixed Hebrew/Latin/number content out correctly while
    // `textAlign` pins the caret and text to the right edge.
    return {
        textAlign: rtlTextAlign(isRtl),
    };
}

/** Single-line inputs in fixed-height pill bars (search fields). */
export function resolveCompactTextInputStyle(
    isRtl: boolean,
    style?: StyleProp<TextStyle>,
): TextStyle {
    const flat = StyleSheet.flatten(style);
    return {
        textAlign: flat?.textAlign ?? rtlTextAlign(isRtl),
        ...(Platform.OS === 'android' && {
            includeFontPadding: false,
            textAlignVertical: 'center',
            paddingVertical: 0,
        }),
        ...flat,
    };
}

type RtlLayoutProviderProps = {
    children: React.ReactNode;
};

export function RtlLayoutProvider({ children }: RtlLayoutProviderProps) {
    const isRtl = useRtlLayout();
    const webDir = Platform.OS === 'web' ? ({ dir: isRtl ? 'rtl' : 'ltr' } as const) : null;

    return (
        <RtlLayoutContext.Provider value={isRtl}>
            <View style={rtlRootStyle(isRtl)} {...(webDir ?? {})}>
                {children}
            </View>
        </RtlLayoutContext.Provider>
    );
}
