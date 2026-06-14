import React, { useState, useCallback } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { submitSupportMessage } from '../../services/admin.service';
import { colors } from '../../theme';

export function PublicSupportScreen() {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!name.trim() || !email.trim() || !message.trim()) return;
        setSubmitting(true);
        try {
            const ok = await submitSupportMessage({ name: name.trim(), email: email.trim(), message: message.trim() });
            if (ok) setSent(true);
        } finally {
            setSubmitting(false);
        }
    }, [name, email, message]);

    const canSubmit = name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;

    return (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <View style={{ backgroundColor: '#1a1a2e', paddingTop: Platform.OS === 'web' ? 24 : 56, paddingBottom: 20, paddingHorizontal: 20 }}>
                <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>KupaPay</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>{t('settings.support')}</Text>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
                {sent ? (
                    <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 20, alignItems: 'center', marginTop: 24 }}>
                        <Text style={{ color: '#15803d', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{t('settings.contactUsSent')}</Text>
                        <Text style={{ color: '#166534', fontSize: 13, marginTop: 6, textAlign: 'center' }}>We'll get back to you soon.</Text>
                    </View>
                ) : (
                    <>
                        <View style={{ backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                            <Text style={{ fontSize: 11, color: colors.gray500, marginBottom: 4 }}>{t('settings.contactUsName')}</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder={t('settings.contactUsName')}
                                placeholderTextColor={colors.gray400}
                                style={{ fontSize: 15, color: '#111827' }}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={{ backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                            <Text style={{ fontSize: 11, color: colors.gray500, marginBottom: 4 }}>{t('settings.contactUsEmail')}</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder={t('settings.contactUsEmail')}
                                placeholderTextColor={colors.gray400}
                                style={{ fontSize: 15, color: '#111827' }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={{ backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                            <Text style={{ fontSize: 11, color: colors.gray500, marginBottom: 4 }}>{t('settings.contactUsMessage')}</Text>
                            <TextInput
                                value={message}
                                onChangeText={setMessage}
                                placeholder={t('settings.contactUsMessagePlaceholder')}
                                placeholderTextColor={colors.gray400}
                                style={{ fontSize: 15, color: '#111827', minHeight: 120 }}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={() => void handleSubmit()}
                            disabled={!canSubmit || submitting}
                            style={{
                                backgroundColor: canSubmit && !submitting ? '#1a1a2e' : '#d1d5db',
                                borderRadius: 12,
                                paddingVertical: 16,
                                alignItems: 'center',
                            }}
                        >
                            {submitting ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={{ color: 'white', fontWeight: '600', fontSize: 15, textAlign: 'center' }}>{t('settings.contactUsSend')}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
