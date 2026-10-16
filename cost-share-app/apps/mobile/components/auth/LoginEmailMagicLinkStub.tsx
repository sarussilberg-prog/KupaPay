import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { showAppToast } from '../../lib/appToast';

type Props = {
    disabled?: boolean;
};

/** Flag-gated placeholder for email OTP / magic-link — no Supabase call yet. */
export function LoginEmailMagicLinkStub({ disabled }: Props) {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');

    const onSubmit = () => {
        showAppToast({
            type: 'info',
            titleKey: 'auth.emailMagicLinkStubHint',
        });
    };

    return (
        <View className="mt-3" testID="login-email-magic-link-stub">
            <Text className="text-xs text-gray-500 mb-2 text-center">
                {t('auth.emailMagicLinkStubHint')}
            </Text>
            <View
                className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-3"
                style={{ minHeight: 52 }}
            >
                <AppIcon name="mail-outline" size={20} color={colors.gray500} />
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    editable={!disabled}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.gray400}
                    className="flex-1 text-base text-gray-900 px-2 py-3"
                    testID="login-email-input"
                />
            </View>
            <TouchableOpacity
                onPress={onSubmit}
                disabled={disabled || !email.trim()}
                activeOpacity={0.85}
                className="mt-2 rounded-2xl bg-primary-dark items-center justify-center"
                style={{ minHeight: 48, opacity: disabled || !email.trim() ? 0.5 : 1 }}
                accessibilityRole="button"
                testID="login-email-magic-link-button"
            >
                <Text className="text-base font-semibold text-white">
                    {t('auth.signInWithEmailMagicLink')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
