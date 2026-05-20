/**
 * Shared bottom-sheet shell for filter & sort modals.
 */

import React, { useEffect, useState, type ReactNode } from 'react';
import {
    View,
    Modal,
    Pressable,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';
import { shadows } from '../../theme/shadows';

export interface FilterBottomSheetProps<T> {
    visible: boolean;
    filters: T;
    title: string;
    subtitle: string;
    onApply: (next: T) => void;
    onClose: () => void;
    onClear: () => T;
    children: (ctx: {
        draft: T;
        setDraft: React.Dispatch<React.SetStateAction<T>>;
    }) => ReactNode;
}

export function FilterBottomSheet<T>({
    visible,
    filters,
    title,
    subtitle,
    onApply,
    onClose,
    onClear,
    children,
}: FilterBottomSheetProps<T>) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const [draft, setDraft] = useState<T>(filters);

    useEffect(() => {
        if (visible) setDraft(filters);
    }, [visible, filters]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable onPress={onClose} style={styles.backdrop}>
                <Pressable onPress={() => {}} style={[styles.sheet, shadows.lg]}>
                    <View className="px-5 pt-4 pb-3">
                        <View className="self-center w-12 h-1 rounded-full bg-gray-200 mb-4" />
                        <Text className="text-xl font-bold text-gray-900">{title}</Text>
                        <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>
                    </View>

                    <ScrollView
                        className="px-5"
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {children({ draft, setDraft })}
                    </ScrollView>

                    <View style={[rtlRowStyle(isRtl), styles.footer]}>
                        <TouchableOpacity
                            onPress={() => setDraft(onClear())}
                            activeOpacity={0.85}
                            style={styles.footerBtnSecondary}
                        >
                            <Text className="text-sm font-semibold text-gray-700">
                                {t('groups.filters.clearAll')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                onApply(draft);
                                onClose();
                            }}
                            activeOpacity={0.85}
                            style={styles.footerBtnPrimary}
                        >
                            <Text className="text-sm font-semibold text-white">
                                {t('groups.filters.apply')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
    },
    scrollContent: {
        paddingBottom: 8,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 28,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.gray200,
        gap: 10,
        backgroundColor: colors.white,
    },
    footerBtnSecondary: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: colors.gray100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerBtnPrimary: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
