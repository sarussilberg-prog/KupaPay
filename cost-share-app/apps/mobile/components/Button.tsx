/**
 * Button Component
 * Reusable button with primary, secondary, pro, and outline variants
 * Uses NativeWind styling only, supports i18n
 */

import { Text } from './AppText';
import { AppIcon, type AppIconName } from './AppIcon';
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { colors } from '../theme';
import { centeredTextStyle } from '../hooks/useRtlLayout';
import { AppPressable } from './AppPressable';
import { androidRippleDanger, androidRippleOnPrimary } from '../lib/androidRipple';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'pro';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    className?: string;
    testID?: string;
    icon?: AppIconName;
    iconColor?: string;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
    primary: {
        container: 'bg-primary rounded-xl py-4 px-6 items-center justify-center',
        text: 'text-white font-semibold text-base text-center',
    },
    pro: {
        container: 'bg-primary rounded-xl py-3 px-6 items-center justify-center',
        text: 'text-white font-semibold text-base text-center',
    },
    secondary: {
        container: 'bg-primary-extra-light rounded-xl py-4 px-6 items-center justify-center',
        text: 'text-primary-dark font-semibold text-base text-center',
    },
    outline: {
        container: 'border border-gray-300 rounded-xl py-4 px-6 bg-white items-center justify-center',
        text: 'text-gray-700 font-semibold text-base text-center',
    },
    danger: {
        container: 'bg-red-500 rounded-xl py-4 px-6 items-center justify-center',
        text: 'text-white font-semibold text-base text-center',
    },
};

export function Button({
    title,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    fullWidth = true,
    className = '',
    testID,
    icon,
    iconColor,
}: ButtonProps) {
    const styles = variantClasses[variant];
    const isDisabled = disabled || loading;
    const ripple =
        variant === 'danger'
            ? androidRippleDanger
            : variant === 'outline' || variant === 'secondary'
              ? undefined
              : androidRippleOnPrimary;

    return (
        <AppPressable
            onPress={onPress}
            disabled={isDisabled}
            testID={testID}
            androidRipple={Platform.OS === 'android' ? ripple : null}
            style={isDisabled ? { opacity: 0.5 } : undefined}
            className={`${styles.container} ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === 'outline' || variant === 'secondary' ? colors.primary : colors.white}
                />
            ) : (
                <View className="w-full flex-row items-center justify-center gap-2">
                    {icon ? (
                        <AppIcon
                            name={icon}
                            size={20}
                            color={
                                iconColor ??
                                (variant === 'outline' || variant === 'secondary'
                                    ? colors.primary
                                    : colors.white)
                            }
                        />
                    ) : null}
                    <Text className={styles.text} style={centeredTextStyle}>
                        {title}
                    </Text>
                </View>
            )}
        </AppPressable>
    );
}
