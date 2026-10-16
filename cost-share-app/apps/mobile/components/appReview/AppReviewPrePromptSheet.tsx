import React from 'react';
import { View, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

export type AppReviewPrePromptMode = 'native' | 'web';

export interface AppReviewPrePromptSheetProps {
    visible: boolean;
    mode: AppReviewPrePromptMode;
    onClose: () => void;
    onHappy: () => void;
    onUnhappy: () => void;
}

export function AppReviewPrePromptSheet({
    visible,
    mode,
    onClose,
    onHappy,
    onUnhappy,
}: AppReviewPrePromptSheetProps) {
    const { t } = useTranslation();
    if (!visible) return null;

    const isWeb = mode === 'web';
    const titleKey = isWeb ? 'appReview.webTitle' : 'appReview.prePromptTitle';
    const messageKey = isWeb ? 'appReview.webMessage' : 'appReview.prePromptMessage';
    const primaryKey = isWeb ? 'appReview.webFeedbackCta' : 'appReview.happyCta';
    const secondaryKey = isWeb ? 'appReview.notNow' : 'appReview.unhappyCta';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/40" onPress={onClose}>
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    className="bg-white rounded-t-2xl absolute bottom-0 inset-x-0 px-5 pb-8 pt-3"
                    testID="app-review-pre-prompt-sheet"
                >
                    <View className="items-center pb-2">
                        <View className="w-10 h-1 bg-gray-300 rounded-full" />
                    </View>
                    <View className="items-center mb-4">
                        <View className="w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center mb-3">
                            <AppIcon
                                name={isWeb ? 'chatbubble-ellipses-outline' : 'star-outline'}
                                size={28}
                                color={colors.primary}
                            />
                        </View>
                        <Text className="text-xl font-bold text-gray-900 text-center text-start mb-2">{t(titleKey)}</Text>
                        <Text className="text-base text-gray-600 text-center text-start leading-6">{t(messageKey)}</Text>
                    </View>
                    <TouchableOpacity
                        testID="app-review-happy-cta"
                        onPress={onHappy}
                        className="bg-blue-500 rounded-xl py-4 mb-3"
                    >
                        <Text className="text-center font-semibold text-white">{t(primaryKey)}</Text>
                    </TouchableOpacity>
                    {!isWeb && (
                        <TouchableOpacity
                            testID="app-review-unhappy-cta"
                            onPress={onUnhappy}
                            className="bg-gray-100 rounded-xl py-4 mb-3"
                        >
                            <Text className="text-center font-semibold text-gray-800">{t(secondaryKey)}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity testID="app-review-not-now" onPress={onClose} className="py-3">
                        <Text className="text-center font-medium text-gray-500">{t('appReview.notNow')}</Text>
                    </TouchableOpacity>
                    {Platform.OS === 'web' && isWeb ? (
                        <Text className="text-xs text-gray-400 text-center text-start mt-2 leading-5">
                            {t('appReview.webStoreHint')}
                        </Text>
                    ) : null}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
