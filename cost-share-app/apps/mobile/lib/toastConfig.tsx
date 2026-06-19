import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { type BaseToastProps } from 'react-native-toast-message';
import { Text } from '../components/AppText';
import { colors } from '../theme';
import { useRtlLayout } from '../hooks/useRtlLayout';

type ToastVariant = {
    borderStartColor: string;
    backgroundColor: string;
};

/**
 * Toast layout for the app.
 *
 * Why a custom component instead of the library's BaseToast/ErrorToast/InfoToast:
 * those render a raw React Native `<Text>` whose alignment is set via inline
 * `textAlign`. On iOS that does NOT right-align Hebrew — the box hugs its content
 * at the start and the text stays stuck to the left (the long-standing bug).
 * Every other Hebrew string in the app aligns correctly because it renders through
 * `<AppText>`, which drives alignment from the store via NativeWind `text-right`
 * + `self-stretch` (className wins over the style prop on native — see useRtlLayout).
 * Routing toast text through `<AppText>` fixes all toast types at once.
 */
function KupaPayToast({
    text1,
    text2,
    onPress,
    variant,
}: BaseToastProps & { variant: ToastVariant }) {
    const isRtl = useRtlLayout();
    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            accessibilityRole="alert"
            // `direction` only flips the accent border to the language's leading edge
            // (borderStart). Text alignment itself is owned by <AppText>.
            style={[styles.base, variant, { direction: isRtl ? 'rtl' : 'ltr' }]}
        >
            <View style={styles.content}>
                {text1 ? (
                    <Text style={styles.text1} numberOfLines={3}>
                        {text1}
                    </Text>
                ) : null}
                {text2 ? (
                    <Text style={styles.text2} numberOfLines={4}>
                        {text2}
                    </Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        borderStartWidth: 4,
        borderLeftWidth: 0,
        borderRadius: 12,
        minHeight: 56,
        width: '92%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
    },
    content: {
        width: '100%',
    },
    text1: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.gray900,
    },
    text2: {
        fontSize: 13,
        fontWeight: '400',
        color: colors.gray600,
        marginTop: 2,
    },
    success: {
        borderStartColor: colors.success.DEFAULT,
        backgroundColor: '#ECFDF5',
    },
    error: {
        borderStartColor: colors.error,
        backgroundColor: '#FEF2F2',
    },
    info: {
        borderStartColor: colors.info,
        backgroundColor: colors.primaryExtraLight,
    },
    warning: {
        borderStartColor: colors.warning,
        backgroundColor: '#FFFBEB',
    },
});

export const toastConfig = {
    success: (props: BaseToastProps) => <KupaPayToast {...props} variant={styles.success} />,
    error: (props: BaseToastProps) => <KupaPayToast {...props} variant={styles.error} />,
    info: (props: BaseToastProps) => <KupaPayToast {...props} variant={styles.info} />,
    warning: (props: BaseToastProps) => <KupaPayToast {...props} variant={styles.warning} />,
};
