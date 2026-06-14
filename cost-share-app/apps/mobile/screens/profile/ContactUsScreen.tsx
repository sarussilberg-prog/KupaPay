import React, { useState, useCallback } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../components/AppText';
import { useAppStore } from '../../store';
import { submitSupportMessage } from '../../services/admin.service';
import { showSuccessMessage } from '../../lib/appToast';
import { handleError } from '../../lib/handleError';
import { colors } from '../../theme';

export function ContactUsScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const currentUser = useAppStore((s) => s.currentUser);

    const [name, setName] = useState(currentUser?.name ?? '');
    const [email, setEmail] = useState(currentUser?.email ?? '');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!name.trim() || !email.trim() || !message.trim()) return;
        setSubmitting(true);
        try {
            const ok = await submitSupportMessage({ name: name.trim(), email: email.trim(), message: message.trim() });
            if (ok) {
                showSuccessMessage('settings.contactUsSent');
                navigation.goBack();
            } else {
                handleError(new Error('submitSupportMessage failed'), {
                    toast: { titleKey: 'common.error', messageKey: 'settings.contactUsError' },
                    tags: { service: 'admin', op: 'submitSupportMessage' },
                });
            }
        } finally {
            setSubmitting(false);
        }
    }, [name, email, message, navigation]);

    const canSubmit = name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;

    return (
        <ScrollView className="flex-1 bg-slate-50" keyboardShouldPersistTaps="handled">
            <View className="px-4 pt-6 pb-8 gap-4">
                <View className="bg-white rounded-xl px-4 py-3">
                    <Text className="text-xs text-gray-500 mb-1">{t('settings.contactUsName')}</Text>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder={t('settings.contactUsName')}
                        placeholderTextColor={colors.gray400}
                        className="text-base text-gray-900"
                        autoCapitalize="words"
                        returnKeyType="next"
                    />
                </View>

                <View className="bg-white rounded-xl px-4 py-3">
                    <Text className="text-xs text-gray-500 mb-1">{t('settings.contactUsEmail')}</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder={t('settings.contactUsEmail')}
                        placeholderTextColor={colors.gray400}
                        className="text-base text-gray-900"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                    />
                </View>

                <View className="bg-white rounded-xl px-4 py-3">
                    <Text className="text-xs text-gray-500 mb-1">{t('settings.contactUsMessage')}</Text>
                    <TextInput
                        value={message}
                        onChangeText={setMessage}
                        placeholder={t('settings.contactUsMessagePlaceholder')}
                        placeholderTextColor={colors.gray400}
                        className="text-base text-gray-900"
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        style={{ minHeight: 120 }}
                    />
                </View>

                <TouchableOpacity
                    onPress={() => void handleSubmit()}
                    disabled={!canSubmit || submitting}
                    className={`rounded-xl py-4 items-center ${canSubmit && !submitting ? 'bg-primary' : 'bg-gray-300'}`}
                >
                    {submitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-semibold text-base text-center">{t('settings.contactUsSend')}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
