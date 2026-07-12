import { Text } from '../AppText';
import React from 'react';
import { View, Modal, TouchableOpacity, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Language } from '@cost-share/shared';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

interface Props {
    visible: boolean;
    current: Language;
    onSelect: (lang: Language) => void;
    onClose: () => void;
    testID?: string;
}

// Each language is labeled in its own native form (endonym), not translated
// into the currently active app language — so "English" always reads as
// "English" and "עברית" always reads as "עברית", regardless of UI locale.
const OPTIONS: { code: Language; nativeLabel: string }[] = [
    { code: 'en', nativeLabel: 'English' },
    { code: 'he', nativeLabel: 'עברית' },
];

export function LanguageSheet({ visible, current, onSelect, onClose, testID }: Props) {
    const { t } = useTranslation();
    if (!visible) return null;
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/40" onPress={onClose}>
                <Pressable
                    testID={testID}
                    onPress={(e) => e.stopPropagation()}
                    className="bg-white rounded-t-2xl absolute bottom-0 inset-x-0"
                >
                    <View className="items-center pt-2 pb-1">
                        <View className="w-10 h-1 bg-gray-300 rounded-full" />
                    </View>
                    <Text className="text-lg font-bold text-gray-900 px-5 mt-2 mb-2">{t('settings.language')}</Text>
                    {OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.code}
                            onPress={() => onSelect(opt.code)}
                            className="flex-row items-center px-5 py-4 border-t border-gray-100"
                        >
                            <Text
                                className="flex-1 text-base text-gray-900"
                                style={{ textAlign: 'left', writingDirection: opt.code === 'he' ? 'rtl' : 'ltr' }}
                            >
                                {opt.nativeLabel}
                            </Text>
                            {opt.code === current ? <AppIcon name="checkmark" size={20} color={colors.primary} /> : null}
                        </TouchableOpacity>
                    ))}
                    <View className="h-6" />
                </Pressable>
            </Pressable>
        </Modal>
    );
}
