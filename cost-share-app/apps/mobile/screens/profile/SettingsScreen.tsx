/**
 * SettingsScreen
 * App settings: language, logout, and future options
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { changeLanguage } from '../../i18n';
import { signOut } from '../../services/auth.service';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function SettingsScreen() {
    const { t } = useTranslation();
    const language = useAppStore((state) => state.language);
    const setLanguage = useAppStore((state) => state.setLanguage);
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    const handleLanguageChange = useCallback(
        async (lang: 'en' | 'he') => {
            try {
                const needsRestart = await changeLanguage(lang);
                setLanguage(lang);

                if (needsRestart) {
                    Alert.alert(
                        t('profile.restartRequired'),
                        t('profile.restartMessage'),
                        [{ text: t('common.ok') }]
                    );
                }
            } catch {
                Alert.alert(t('common.error'), t('profile.languageChangeError'));
            }
        },
        [setLanguage, t]
    );

    const handleLogout = useCallback(async () => {
        setShowLogoutDialog(false);
        await signOut();
    }, []);

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="px-4 pt-4">
                <Text className="text-sm font-semibold text-gray-500 mb-2 px-1">
                    {t('settings.language')}
                </Text>
                <View className="bg-white rounded-xl px-4 py-4 mb-6">
                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Button
                                title={t('profile.english')}
                                onPress={() => handleLanguageChange('en')}
                                variant={language === 'en' ? 'primary' : 'outline'}
                            />
                        </View>
                        <View className="flex-1">
                            <Button
                                title={t('profile.hebrew')}
                                onPress={() => handleLanguageChange('he')}
                                variant={language === 'he' ? 'primary' : 'outline'}
                            />
                        </View>
                    </View>
                </View>

                <View className="mb-8">
                    <Button
                        title={t('profile.logout')}
                        onPress={() => setShowLogoutDialog(true)}
                        variant="danger"
                    />
                </View>
            </View>

            <ConfirmDialog
                visible={showLogoutDialog}
                title={t('profile.logout')}
                message={t('profile.logoutConfirm')}
                confirmText={t('profile.logout')}
                cancelText={t('common.cancel')}
                onConfirm={handleLogout}
                onCancel={() => setShowLogoutDialog(false)}
                destructive
            />
        </ScrollView>
    );
}
