import React from 'react';
import { Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { useAppExitGuard } from '../hooks/useAppExitGuard';

/**
 * Cross-platform exit confirmation when system Back has nothing left to pop
 * in the React Navigation stack (web browser Back + Android hardware Back).
 */
export function AppExitGuard() {
    const { t } = useTranslation();
    const { exitConfirmVisible, cancelExit, confirmExit } = useAppExitGuard();

    if (!exitConfirmVisible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={cancelExit}>
            <Pressable
                className="flex-1 bg-black/50 justify-center items-center p-4"
                onPress={cancelExit}
            >
                <Pressable
                    onPress={e => e.stopPropagation()}
                    className="bg-white rounded-2xl p-6 w-full max-w-sm"
                >
                    <Text className="text-xl font-bold text-gray-900 mb-2">
                        {t('appExitGuard.title')}
                    </Text>
                    <Text className="text-base text-gray-600 mb-4">
                        {t('appExitGuard.message')}
                    </Text>
                    <View className="gap-2">
                        <TouchableOpacity
                            onPress={confirmExit}
                            className="rounded-lg p-4 bg-red-500"
                        >
                            <Text className="text-center font-semibold text-white">
                                {t('appExitGuard.leave')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={cancelExit}
                            className="rounded-lg p-4 bg-gray-100"
                        >
                            <Text className="text-center font-semibold text-gray-700">
                                {t('appExitGuard.stay')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
