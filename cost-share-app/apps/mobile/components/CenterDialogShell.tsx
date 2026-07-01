/**
 * CenterDialogShell — reusable centered-dialog wrapper.
 * Presents a card centered in the screen (fade in) instead of a bottom sheet.
 * Header has two optional slots that keep the title centered whether present or
 * not: a leading action (leftLabel/onLeftPress — e.g. Cancel or Back) and a
 * trailing action (saveLabel/onSave — e.g. Save or Send). Used by the remind
 * flow. Wraps content in a KeyboardAvoidingView so a focused TextInput (compose
 * step) isn't hidden behind the keyboard.
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

interface CenterDialogShellProps {
    visible: boolean;
    label: string;
    onClose: () => void;
    /** Leading header action (e.g. Cancel / Back). Hidden when omitted. */
    leftLabel?: string;
    onLeftPress?: () => void;
    /** Trailing header action (e.g. Save / Send). Hidden when omitted. */
    saveLabel?: string;
    onSave?: () => void;
    saveDisabled?: boolean;
    children: React.ReactNode;
}

// Equal min-width on both header slots so the centered title stays centered
// regardless of which actions are present.
const HEADER_SLOT_MIN_WIDTH = 64;

export function CenterDialogShell({
    visible,
    label,
    onClose,
    leftLabel,
    onLeftPress,
    saveLabel,
    onSave,
    saveDisabled = false,
    children,
}: CenterDialogShellProps) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const maxHeight = Math.round(height * 0.8);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <View
                    className="flex-1 items-center justify-center px-6"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
                >
                    <Pressable
                        testID="center-dialog-scrim"
                        onPress={onClose}
                        className="absolute inset-0"
                    />
                    <View
                        style={{
                            maxHeight,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.18,
                            shadowRadius: 24,
                            elevation: 24,
                        }}
                        className="w-full max-w-[420px] bg-white rounded-3xl overflow-hidden"
                    >
                        <View className="flex-row items-center px-4 py-3">
                            <View
                                style={{ minWidth: HEADER_SLOT_MIN_WIDTH }}
                                className="items-start"
                            >
                                {onLeftPress ? (
                                    <Pressable onPress={onLeftPress} hitSlop={8}>
                                        <Text className="text-[15px] font-medium text-gray-600">
                                            {leftLabel ?? t('common.cancel')}
                                        </Text>
                                    </Pressable>
                                ) : null}
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
                                    <Pressable
                                        onPress={() => { if (!saveDisabled) onSave(); }}
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
                                            {saveLabel ?? t('common.save')}
                                        </Text>
                                    </Pressable>
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
