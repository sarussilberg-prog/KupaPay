import React from 'react';
import { View, Modal, TouchableOpacity, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

export interface AppReviewWebFeedbackSheetProps {
    visible: boolean;
    onClose: () => void;
    onShareFeedback: () => void;
}

/** Gentle feedback prompt for Expo web — no store review APIs. */
export function AppReviewWebFeedbackSheet({
    visible,
    onClose,
    onShareFeedback,
}: AppReviewWebFeedbackSheetProps) {
    const { t } = useTranslation();
    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/40" onPress={onClose}>
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    className="bg-white rounded-t-2xl absolute bottom-0 inset-x-0 px-5 pb-8 pt-3"
                    testID="app-review-web-feedback-sheet"
                >
                    <View className="items-center pb-2">
                        <View className="w-10 h-1 bg-gray-300 rounded-full" />
                    </View>
                    <View className="items-center mb-4">
                        <View className="w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center mb-3">
                            <AppIcon
                                name="chatbubble-ellipses-outline"
                                size={28}
                                color={colors.primary}
                            />
                        </View>
                        <Text className="text-xl font-bold text-gray-900 text-center text-start mb-2">
                            {t('appReview.webTitle')}
                        </Text>
                        <Text className="text-base text-gray-600 text-center text-start leading-6">
                            {t('appReview.webMessage')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        testID="app-review-web-feedback-cta"
                        onPress={onShareFeedback}
                        className="bg-blue-500 rounded-xl py-4 mb-3"
                    >
                        <Text className="text-center font-semibold text-white">
                            {t('appReview.webFeedbackCta')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="app-review-web-not-now" onPress={onClose} className="py-3">
                        <Text className="text-center font-medium text-gray-500">{t('appReview.notNow')}</Text>
                    </TouchableOpacity>
                    <Text className="text-xs text-gray-400 text-center text-start mt-2 leading-5">
                        {t('appReview.webStoreHint')}
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
