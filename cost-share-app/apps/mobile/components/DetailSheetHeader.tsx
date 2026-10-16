/**
 * DetailSheetHeader — shared top bar for FeedItemDetailSheet (expense + settlement).
 * Layout: close ✕ · centered uppercase label · ⋮ kebab popover.
 * Menu items are rendered for each provided callback. The kebab is hidden when
 * no callbacks are passed (e.g., a read-only deletion-notice with nothing to do).
 */

import React, { useState } from 'react';
import {
    View,
    Pressable,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { colors } from '../theme';
import { MenuRow } from './ui/MenuRow';

export interface DetailSheetHeaderProps {
    /** Label shown centered; rendered uppercase by the component. */
    label: string;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onRemoveFromActivity?: () => void;
    onOpenInGroup?: () => void;
    openInGroupLabel?: string;
}

export function DetailSheetHeader({
    label,
    onClose,
    onEdit,
    onDelete,
    onRemoveFromActivity,
    onOpenInGroup,
    openInGroupLabel,
}: DetailSheetHeaderProps) {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleEdit = () => { setMenuOpen(false); onEdit?.(); };
    const handleDelete = () => { setMenuOpen(false); onDelete?.(); };
    const handleRemoveFromActivity = () => { setMenuOpen(false); onRemoveFromActivity?.(); };
    const handleOpenInGroup = () => { setMenuOpen(false); onOpenInGroup?.(); };

    const hasMenu = Boolean(onEdit || onDelete || onRemoveFromActivity || onOpenInGroup);

    return (
        <View
            className="flex-row items-center justify-between px-2 pb-1"
            style={{ position: 'relative', zIndex: 5 }}
        >
            <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('groups.filters.close')}
                className="w-11 h-11 items-center justify-center"
            >
                <AppIcon name="close" size={22} color={colors.gray600} />
            </TouchableOpacity>

            <Text
                className="text-xs font-semibold uppercase text-gray-500"
                style={{ letterSpacing: 0.7 }}
            >
                {label}
            </Text>

            {hasMenu ? (
                <View>
                    <TouchableOpacity
                        onPress={() => setMenuOpen((o) => !o)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        className="w-11 h-11 items-center justify-center"
                        testID="detail-kebab-btn"
                    >
                        <AppIcon
                            name="ellipsis-vertical"
                            size={20}
                            color={colors.gray600}
                        />
                    </TouchableOpacity>

                    {menuOpen && (
                        <>
                            <Pressable
                                onPress={() => setMenuOpen(false)}
                                style={styles.menuBackdrop}
                            />
                            <View style={styles.menuCard}>
                                {onOpenInGroup && (
                                    <MenuRow
                                        iconName="arrow-forward-outline"
                                        iconColor={colors.gray700}
                                        label={openInGroupLabel ?? t('activity.openInGroup', { group: '' })}
                                        onPress={handleOpenInGroup}
                                        testID="detail-open-in-group-btn"
                                    />
                                )}
                                {onEdit && (
                                    <MenuRow
                                        iconName="create-outline"
                                        iconColor={colors.gray700}
                                        label={t('common.edit')}
                                        onPress={handleEdit}
                                        testID="detail-edit-btn"
                                    />
                                )}
                                {onDelete && (
                                    <MenuRow
                                        iconName="trash-outline"
                                        iconColor={colors.error}
                                        label={t('common.delete')}
                                        labelClassName="text-sm font-medium text-red-600"
                                        onPress={handleDelete}
                                        testID="detail-delete-btn"
                                    />
                                )}
                                {onRemoveFromActivity && (
                                    <MenuRow
                                        iconName="trash-outline"
                                        iconColor={colors.error}
                                        label={t('activity.removeFromActivity')}
                                        labelClassName="text-sm font-medium text-red-600"
                                        onPress={handleRemoveFromActivity}
                                        testID="detail-remove-from-activity-btn"
                                    />
                                )}
                            </View>
                        </>
                    )}
                </View>
            ) : (
                // Spacer so the centered label stays centered.
                <View className="w-11 h-11" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    menuCard: {
        position: 'absolute',
        top: 42,
        right: 4,
        minWidth: 160,
        padding: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        elevation: 8,
        zIndex: 10,
    },
    menuBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 9,
    },
});
