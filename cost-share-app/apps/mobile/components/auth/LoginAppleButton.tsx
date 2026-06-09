import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';

type Props = {
    onPress: () => void;
    title?: string;
    disabled?: boolean;
    testID?: string;
};

// iOS: Apple's HIG requires the official native button (it localizes its own label).
// Android/web: there is no native Apple button, so render an HIG-styled black button
// that drives the same Apple sign-in handler (web OAuth under the hood).
export function LoginAppleButton({
    onPress,
    title,
    disabled = false,
    testID = 'login-apple-button',
}: Props) {
    if (Platform.OS === 'ios') {
        return (
            <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={27}
                style={[styles.nativeButton, disabled && styles.disabled]}
                onPress={disabled ? noop : onPress}
            />
        );
    }

    return (
        <TouchableOpacity
            onPress={disabled ? noop : onPress}
            activeOpacity={0.82}
            disabled={disabled}
            testID={testID}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            style={[styles.androidButton, disabled && styles.disabled]}
        >
            <View style={styles.content}>
                <AppIcon name="logo-apple" size={22} color="#FFFFFF" />
                <Text className="text-base font-bold text-white">{title}</Text>
            </View>
        </TouchableOpacity>
    );
}

function noop() {}

const styles = StyleSheet.create({
    nativeButton: {
        height: 54,
        width: '100%',
    },
    androidButton: {
        height: 54,
        borderRadius: 999,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    disabled: {
        opacity: 0.7,
    },
});
