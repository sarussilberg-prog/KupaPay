import React from 'react';
import { Modal, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from './AppText';

interface RestoreAccountDialogProps {
    visible: boolean;
    title: string;
    message: string;
    restoreLabel: string;
    cancelLabel: string;
    loading?: boolean;
    onRestore: () => void;
    onCancel: () => void;
}

export function RestoreAccountDialog({
    visible,
    title,
    message,
    restoreLabel,
    cancelLabel,
    loading = false,
    onRestore,
    onCancel,
}: RestoreAccountDialogProps) {
    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
            <View className="flex-1 bg-black/50 justify-center items-center p-4">
                <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
                    <Text className="text-xl font-bold text-gray-900 mb-2">{title}</Text>
                    <Text className="text-base text-gray-600 mb-6">{message}</Text>
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={onCancel}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
                            accessibilityRole="button"
                        >
                            <Text className="text-base font-semibold text-gray-700 text-center">{cancelLabel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onRestore}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-primary items-center justify-center"
                            accessibilityRole="button"
                            testID="restore-account-confirm"
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-base font-semibold text-white text-center">{restoreLabel}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
