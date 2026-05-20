/**
 * CreateGroupScreen
 * Form to create a new group
 * Uses NativeWind styling only, full i18n support
 */

import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { GroupType, DEFAULT_CURRENCY } from '@cost-share/shared';
import { useLoading } from '../../hooks/useLoading';
import { useAppStore } from '../../store';
import { createGroup, updateGroup } from '../../services/groups.service';
import { uploadGroupImage } from '../../services/storage.service';
import { GroupImagePicker } from '../../components/GroupImagePicker';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { GroupTypeSelector } from '../../components/GroupTypeSelector';

export function CreateGroupScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { isLoading, startLoading, stopLoading } = useLoading();
    const currentUser = useAppStore((state) => state.currentUser);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [groupType, setGroupType] = useState<GroupType>('general');
    const [currency, setCurrency] = useState(currentUser?.defaultCurrency || DEFAULT_CURRENCY);
    const [nameError, setNameError] = useState('');
    const [localImageUri, setLocalImageUri] = useState<string | null>(null);

    const validateForm = (): boolean => {
        if (!name.trim()) {
            setNameError(t('groups.nameRequired'));
            return false;
        }
        setNameError('');
        return true;
    };

    const handleCreate = async () => {
        if (!validateForm()) return;

        startLoading();
        try {
            const result = await createGroup({
                name: name.trim(),
                description: description.trim() || undefined,
                groupType,
                defaultCurrency: currency,
                memberIds: [],
            });

            if (!result) return;

            if (localImageUri) {
                const imageUrl = await uploadGroupImage(result.id, localImageUri);
                if (!imageUrl) {
                    Toast.show({
                        type: 'error',
                        text1: t('common.error'),
                        text2: t('groups.imageUploadError'),
                    });
                } else {
                    await updateGroup(result.id, { imageUrl });
                }
            }

            navigation.replace('GroupDetail', { groupId: result.id });
        } finally {
            stopLoading();
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-4">
                <GroupImagePicker
                    localUri={localImageUri}
                    groupType={groupType}
                    onChange={setLocalImageUri}
                />

                {/* Group Name */}
                <Input
                    label={t('groups.groupName')}
                    placeholder={t('groups.enterGroupName')}
                    value={name}
                    onChangeText={(text) => {
                        setName(text);
                        if (nameError) setNameError('');
                    }}
                    error={nameError}
                />

                {/* Description */}
                <Input
                    label={t('groups.description')}
                    placeholder={t('groups.enterDescription')}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                />

                <GroupTypeSelector value={groupType} onChange={setGroupType} />

                {/* Currency */}
                <CurrencyPicker
                    value={currency}
                    onChange={setCurrency}
                    label={t('groups.currency')}
                />

                {/* Create Button */}
                <View className="mt-4">
                    <Button
                        title={t('groups.createGroup')}
                        onPress={handleCreate}
                        loading={isLoading}
                        disabled={isLoading}
                    />
                </View>
            </View>
        </ScrollView>
    );
}
