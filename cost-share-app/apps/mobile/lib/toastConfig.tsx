import React from 'react';
import { StyleSheet } from 'react-native';
import {
    BaseToast,
    ErrorToast,
    InfoToast,
    type BaseToastProps,
} from 'react-native-toast-message';
import { colors } from '../theme';
import { rtlTextAlign, rtlWritingDirection } from '../hooks/useRtlLayout';
import { useAppStore } from '../store';

function useToastRtl(): boolean {
    const language = useAppStore((s) => s.language);
    return language === 'he';
}

export function toastTextStyles(isRtl: boolean) {
    const align = rtlTextAlign(isRtl);
    const writingDirection = rtlWritingDirection(isRtl);
    // On native, textAlign alone doesn't move the text: the <Text> box hugs its
    // content at the container's start (left in logical-RTL mode) so right-aligned
    // Hebrew looks stuck left. Stretching the box to full width makes textAlign
    // take effect — same pattern as centeredTextStyle/feedActorNameStyle.
    return {
        text1: {
            fontSize: 15,
            fontWeight: '600' as const,
            color: colors.gray900,
            textAlign: align,
            writingDirection,
            alignSelf: 'stretch' as const,
            width: '100%' as const,
        },
        text2: {
            fontSize: 13,
            fontWeight: '400' as const,
            color: colors.gray600,
            textAlign: align,
            writingDirection,
            alignSelf: 'stretch' as const,
            width: '100%' as const,
        },
    };
}

function KupaPayBaseToast(props: BaseToastProps) {
    const isRtl = useToastRtl();
    const textStyles = toastTextStyles(isRtl);
    return (
        <BaseToast
            {...props}
            style={[styles.base, { direction: isRtl ? 'rtl' : 'ltr' }, props.style]}
            contentContainerStyle={[styles.content, props.contentContainerStyle]}
            text1Style={[textStyles.text1, props.text1Style]}
            text2Style={[textStyles.text2, props.text2Style]}
            text1NumberOfLines={3}
            text2NumberOfLines={4}
        />
    );
}

function KupaPayErrorToast(props: BaseToastProps) {
    const isRtl = useToastRtl();
    const textStyles = toastTextStyles(isRtl);
    return (
        <ErrorToast
            {...props}
            style={[styles.base, styles.error, { direction: isRtl ? 'rtl' : 'ltr' }, props.style]}
            contentContainerStyle={[styles.content, props.contentContainerStyle]}
            text1Style={[textStyles.text1, props.text1Style]}
            text2Style={[textStyles.text2, props.text2Style]}
            text1NumberOfLines={3}
            text2NumberOfLines={4}
        />
    );
}

function KupaPayInfoToast(props: BaseToastProps) {
    const isRtl = useToastRtl();
    const textStyles = toastTextStyles(isRtl);
    return (
        <InfoToast
            {...props}
            style={[styles.base, styles.info, { direction: isRtl ? 'rtl' : 'ltr' }, props.style]}
            contentContainerStyle={[styles.content, props.contentContainerStyle]}
            text1Style={[textStyles.text1, props.text1Style]}
            text2Style={[textStyles.text2, props.text2Style]}
            text1NumberOfLines={3}
            text2NumberOfLines={4}
        />
    );
}

const styles = StyleSheet.create({
    base: {
        borderStartWidth: 4,
        borderLeftWidth: 0,
        borderRadius: 12,
        minHeight: 56,
        width: '92%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    error: {
        borderStartColor: colors.error,
        backgroundColor: '#FEF2F2',
    },
    info: {
        borderStartColor: colors.info,
        backgroundColor: colors.primaryExtraLight,
    },
});

export const toastConfig = {
    success: (props: BaseToastProps) => (
        <KupaPayBaseToast
            {...props}
            style={[
                styles.base,
                {
                    borderStartColor: colors.success.DEFAULT,
                    backgroundColor: '#ECFDF5',
                },
                props.style,
            ]}
        />
    ),
    error: (props: BaseToastProps) => <KupaPayErrorToast {...props} />,
    info: (props: BaseToastProps) => <KupaPayInfoToast {...props} />,
    warning: (props: BaseToastProps) => (
        <KupaPayBaseToast
            {...props}
            style={[
                styles.base,
                {
                    borderStartColor: colors.warning,
                    backgroundColor: '#FFFBEB',
                },
                props.style,
            ]}
        />
    ),
};
