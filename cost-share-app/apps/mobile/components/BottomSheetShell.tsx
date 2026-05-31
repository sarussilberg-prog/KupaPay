/**
 * BottomSheetShell — reusable bottom-sheet wrapper.
 * Provides: scrim, sheet container (75% height, rounded top, sheet shadow),
 * drag handle, header row (Cancel · uppercase label · Save), hairline divider.
 * Children render in a scrollable body below the header.
 */
import React from 'react';
import {
    Modal,
    Pressable,
    View,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';

interface BottomSheetShellProps {
    visible: boolean;
    label: string;
    onClose: () => void;
    onSave?: () => void;
    saveDisabled?: boolean;
    children: React.ReactNode;
}

export function BottomSheetShell({
    visible,
    label,
    onClose,
    onSave,
    saveDisabled = false,
    children,
}: BottomSheetShellProps) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const sheetHeight = Math.round(height * 0.75);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
                <Pressable
                    testID="bottom-sheet-scrim"
                    onPress={onClose}
                    className="absolute inset-0"
                />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View
                        style={{
                            height: sheetHeight,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -8 },
                            shadowOpacity: 0.18,
                            shadowRadius: 24,
                            elevation: 24,
                        }}
                        className="bg-white rounded-t-3xl overflow-hidden"
                    >
                        <View className="items-center pt-2">
                            <View className="w-10 h-1 rounded-full bg-gray-200" />
                        </View>
                        <View className="flex-row items-center justify-between px-4 py-3">
                            <Pressable onPress={onClose} hitSlop={8}>
                                <Text className="text-[15px] font-medium text-gray-600">
                                    {t('common.cancel')}
                                </Text>
                            </Pressable>
                            <Text
                                className="text-xs font-semibold text-gray-500 uppercase"
                                style={{ letterSpacing: 0.06 * 12 }}
                            >
                                {label}
                            </Text>
                            <Pressable
                                onPress={() => { if (!saveDisabled && onSave) onSave(); }}
                                hitSlop={8}
                                disabled={saveDisabled}
                            >
                                <Text
                                    className={
                                        saveDisabled
                                            ? 'text-[15px] font-bold text-gray-300'
                                            : 'text-[15px] font-bold text-primary-dark'
                                    }
                                >
                                    {t('common.save')}
                                </Text>
                            </Pressable>
                        </View>
                        <View className="h-px bg-border-soft" />
                        <View className="flex-1">{children}</View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}
