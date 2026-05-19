/**
 * EditProfileScreen
 * Form to edit user profile
 * Uses NativeWind styling only, full i18n support
 */

import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../store';
import { useLoading } from '../../hooks/useLoading';
import { updateUser } from '../../services/users.service';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import Toast from 'react-native-toast-message';

export function EditProfileScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { isLoading, startLoading, stopLoading } = useLoading();
    const currentUser = useAppStore((state) => state.currentUser);

    const [name, setName] = useState(currentUser?.name || '');
    const [phone, setPhone] = useState(currentUser?.phone || '');
    const [currency, setCurrency] = useState(currentUser?.defaultCurrency || 'USD');
    const [nameError, setNameError] = useState('');

    const validateForm = (): boolean => {
        if (!name.trim()) {
            setNameError(t('profile.nameRequired'));
            return false;
        }
        setNameError('');
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        if (!currentUser) return;

        startLoading();
        const result = await updateUser(currentUser.id, {
            name: name.trim(),
            phone: phone.trim() || undefined,
            defaultCurrency: currency,
        });
        stopLoading();

        if (result) {
            Toast.show({
                type: 'success',
                text1: t('common.success'),
                text2: t('profile.profileUpdated'),
            });
            navigation.goBack();
        } else {
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('profile.updateError'),
            });
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-4">
                {/* Name */}
                <Input
                    label={t('profile.name')}
                    placeholder={t('profile.enterName')}
                    value={name}
                    onChangeText={(text) => {
                        setName(text);
                        if (nameError) setNameError('');
                    }}
                    error={nameError}
                />

                {/* Email (read-only) */}
                <Input
                    label={t('profile.email')}
                    value={currentUser?.email || ''}
                    editable={false}
                />

                {/* Phone */}
                <Input
                    label={t('profile.phone')}
                    placeholder={t('profile.enterPhone')}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />

                {/* Default Currency */}
                <CurrencyPicker
                    value={currency}
                    onChange={setCurrency}
                    label={t('profile.defaultCurrency')}
                />

                {/* Actions */}
                <View className="mt-4 gap-2">
                    <Button
                        title={t('common.save')}
                        onPress={handleSave}
                        loading={isLoading}
                        disabled={isLoading}
                    />
                    <Button
                        title={t('common.cancel')}
                        onPress={() => navigation.goBack()}
                        variant="outline"
                    />
                </View>
            </View>
        </ScrollView>
    );
}
