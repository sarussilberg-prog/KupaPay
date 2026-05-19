/**
 * ProfileScreen
 * User profile with edit action and link to settings
 * Uses NativeWind styling only, full i18n support
 */

import React, { useCallback, useLayoutEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../store';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AppIcon } from '../../components/AppIcon';
import { Button } from '../../components/Button';
import { colors } from '../../theme';

export function ProfileScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const currentUser = useAppStore((state) => state.currentUser);

    const handleOpenSettings = useCallback(() => {
        navigation.navigate('Settings');
    }, [navigation]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleOpenSettings}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    testID="profile-settings-button"
                    className="mr-2"
                >
                    <AppIcon name="settings-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            ),
        });
    }, [navigation, handleOpenSettings]);

    const handleEditProfile = useCallback(() => {
        navigation.navigate('EditProfile');
    }, [navigation]);

    return (
        <ScrollView className="flex-1 bg-slate-50">
            {/* Profile Header */}
            <View className="bg-white px-4 py-8 items-center mb-4">
                <MemberAvatar
                    name={currentUser?.name || '?'}
                    avatarUrl={currentUser?.avatarUrl}
                    size="lg"
                />
                <Text className="text-xl font-bold text-gray-900 mt-3">
                    {currentUser?.name || t('common.unknown')}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                    {currentUser?.email || ''}
                </Text>
            </View>

            {/* Actions */}
            <View className="px-4 mb-8 gap-2">
                <Button
                    title={t('profile.editProfile')}
                    onPress={handleEditProfile}
                    variant="outline"
                />
            </View>
        </ScrollView>
    );
}
