/**
 * LoginScreen
 * Authentication screen with Google sign-in
 * Uses NativeWind styling only, full i18n support
 */

import React from 'react';
import { View, Text } from 'react-native';
import { AppIcon } from '../../components/AppIcon';
import { colors } from '../../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useLoading } from '../../hooks/useLoading';
import { signInWithGoogle } from '../../services/auth.service';
import { Button } from '../../components/Button';
import Toast from 'react-native-toast-message';

export function LoginScreen() {
    const { t } = useTranslation();
    const { isLoading, startLoading, stopLoading } = useLoading();

    const handleSignIn = async () => {
        startLoading();
        try {
            const { error } = await signInWithGoogle();
            if (error) {
                Toast.show({
                    type: 'error',
                    text1: t('auth.signInError'),
                    text2: error.message,
                });
            }
        } catch (err) {
            Toast.show({
                type: 'error',
                text1: t('auth.signInError'),
            });
        } finally {
            stopLoading();
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 justify-center items-center px-8">
                {/* App Icon / Branding */}
                <View className="w-20 h-20 rounded-2xl bg-primary-extra-light justify-center items-center mb-6">
                    <AppIcon name="wallet" size={40} color={colors.primary} />
                </View>

                {/* App Name */}
                <Text className="text-3xl font-bold text-gray-900 mb-2">
                    {t('auth.appName')}
                </Text>

                {/* Subtitle */}
                <Text className="text-base text-gray-500 text-center mb-12">
                    {t('auth.subtitle')}
                </Text>

                {/* Sign In Button */}
                <Button
                    title={t('auth.signInWithGoogle')}
                    onPress={handleSignIn}
                    loading={isLoading}
                    disabled={isLoading}
                />
            </View>
        </SafeAreaView>
    );
}
