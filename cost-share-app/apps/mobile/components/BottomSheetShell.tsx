/**
 * BottomSheetShell — reusable bottom-sheet wrapper.
 * Provides: scrim, sheet container (fits content, caps at 75% height, rounded top, sheet shadow),
 * drag handle, header row (Cancel · uppercase label · Save), hairline divider.
 * Children render in a scrollable body below the header.
 */
import React, { useCallback } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    View,
    useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { AppPressable } from './AppPressable';
import { useAndroidHardwareBackHandler } from '../hooks/useAndroidHardwareBackHandler';
import { nativeKeyboardAvoidingBehavior } from '../lib/platformKeyboard';

interface BottomSheetShellProps {
    visible: boolean;
    label: string;
    onClose: () => void;
    onSave?: () => void;
    saveDisabled?: boolean;
    children: React.ReactNode;
}

/** Equal min-width on header slots keeps the title centered (incl. RTL). */
const HEADER_SLOT_MIN_WIDTH = 64;

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
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);
    useAndroidHardwareBackHandler(visible, handleClose);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={nativeKeyboardAvoidingBehavior()}
                className="flex-1 justify-end"
            >
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
                <AppPressable
                    testID="bottom-sheet-scrim"
                    onPress={handleClose}
                    className="absolute inset-0"
                    androidRipple={null}
                />
                <View
                    style={{
                        maxHeight: sheetHeight,
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
                    <View className="flex-row items-center px-4 py-3">
                        <View
                            style={{ minWidth: HEADER_SLOT_MIN_WIDTH }}
                            className="items-start"
                        >
                            <AppPressable onPress={handleClose} hitSlop={8}>
                                <Text className="text-[15px] font-medium text-gray-600">
                                    {t('common.cancel')}
                                </Text>
                            </AppPressable>
                        </View>
                        <Text
                            className="flex-1 text-center text-xs font-semibold text-gray-500 uppercase"
                            style={{ letterSpacing: 0.06 * 12 }}
                        >
                            {label}
                        </Text>
                        <View
                            style={{ minWidth: HEADER_SLOT_MIN_WIDTH }}
                            className="items-end"
                        >
                            {onSave ? (
                                <AppPressable
                                    onPress={() => {
                                        if (!saveDisabled) onSave();
                                    }}
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
                                </AppPressable>
                            ) : null}
                        </View>
                    </View>
                    <View className="h-px bg-border-soft" />
                    <View style={{ flexShrink: 1 }}>{children}</View>
                </View>
            </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
