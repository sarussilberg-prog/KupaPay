/**
 * MessageComposerSheet — bottom modal with multi-line input + send button.
 * Used for both creating and editing messages.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { resolveCompactTextInputStyle, useRtlLayout } from '../hooks/useRtlLayout';
import { colors } from '../theme';

interface MessageComposerSheetProps {
    visible: boolean;
    mode: 'create' | 'edit';
    initialBody?: string;
    onSubmit: (body: string) => Promise<void> | void;
    onClose: () => void;
}

export function MessageComposerSheet({
    visible,
    mode,
    initialBody,
    onSubmit,
    onClose,
}: MessageComposerSheetProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const insets = useSafeAreaInsets();
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const inputRef = useRef<TextInput | null>(null);

    useEffect(() => {
        if (!visible) {
            setKeyboardHeight(0);
            return;
        }
        setBody(initialBody ?? '');
        const focusId = setTimeout(() => inputRef.current?.focus(), 80);

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, e => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

        return () => {
            clearTimeout(focusId);
            showSub.remove();
            hideSub.remove();
        };
    }, [visible, initialBody]);

    const trimmed = body.trim();
    const sendDisabled = submitting || trimmed.length === 0;
    const sheetBottomInset = Platform.OS === 'android' && keyboardHeight > 0
        ? keyboardHeight + 8
        : insets.bottom + 12;

    const handleSubmit = async () => {
        if (sendDisabled) return;
        try {
            setSubmitting(true);
            await onSubmit(trimmed);
        } finally {
            setSubmitting(false);
        }
    };

    const sheet = (
        <Pressable
            onPress={(e) => e?.stopPropagation()}
            className="bg-white rounded-t-2xl px-4 pt-3"
            style={{ paddingBottom: sheetBottomInset }}
        >
            {mode === 'edit' && (
                <Text className="text-sm font-semibold text-gray-700 px-1 pb-2">
                    {t('groups.message.editTitle')}
                </Text>
            )}
            <View className="flex-row items-end">
                <View className="flex-1 bg-gray-100 rounded-2xl px-3 py-2 mr-2">
                    <TextInput
                        ref={inputRef}
                        value={body}
                        onChangeText={setBody}
                        placeholder={t('groups.message.composerPlaceholder')}
                        placeholderTextColor={colors.gray400}
                        multiline
                        maxLength={2000}
                        textAlignVertical="top"
                        className="text-sm text-gray-900"
                        style={[
                            { minHeight: 40, maxHeight: 120 },
                            resolveCompactTextInputStyle(isRtl, { textAlignVertical: 'top' }),
                        ]}
                        testID="composer-input"
                    />
                </View>
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={sendDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('groups.message.send')}
                    style={{ opacity: sendDisabled ? 0.4 : 1, marginBottom: 2 }}
                    className="w-11 h-11 rounded-full bg-primary items-center justify-center"
                    testID="composer-send"
                >
                    <View
                        style={
                            mode !== 'edit' && isRtl
                                ? { transform: [{ scaleX: -1 }] }
                                : undefined
                        }
                    >
                        <AppIcon
                            name={mode === 'edit' ? 'checkmark' : 'send'}
                            size={18}
                            color="#fff"
                        />
                    </View>
                </TouchableOpacity>
            </View>
        </Pressable>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
                {Platform.OS === 'ios' ? (
                    <KeyboardAvoidingView behavior="padding">
                        {sheet}
                    </KeyboardAvoidingView>
                ) : (
                    sheet
                )}
            </Pressable>
        </Modal>
    );
}
