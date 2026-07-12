/**
 * GroupPickerSheet — a Modal list picker for choosing the favorite group.
 * Presentational: receives `groups` as a prop (no query), so it's reused by the
 * FavoriteGroupSwitcher and is easy to unit-test. Modelled on
 * components/dashboard/FriendGroupBalancesSheet.tsx.
 */
import React from 'react';
import { Modal, Pressable, View, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupWithMembers } from '@cost-share/shared';
import { Text } from '../AppText';
import { GroupAvatar } from '../GroupAvatar';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

interface Props {
    visible: boolean;
    groups: GroupWithMembers[];
    selectedGroupId: string | null;
    onSelectGroup: (groupId: string) => void;
    onClose: () => void;
    /**
     * Optional header title. Defaults to the favorite-group picker title so
     * existing callers (FavoriteGroupSwitcher) are unaffected; other callers
     * (e.g. the Add Expense group pill) can pass a context-appropriate title.
     */
    title?: string;
}

export function GroupPickerSheet({
    visible,
    groups,
    selectedGroupId,
    onSelectGroup,
    onClose,
    title,
}: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const headerTitle = title ?? t('favoriteGroup.pickerTitle');

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                testID="group-picker-scrim"
                onPress={onClose}
                className="flex-1 bg-black/40 justify-center px-4"
            >
                <Pressable onPress={() => {}} className="bg-white rounded-2xl max-h-[60%]">
                    <View
                        style={rtlRowStyle(isRtl)}
                        className="px-4 pt-4 pb-3 items-center border-b border-slate-100"
                    >
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                                {headerTitle}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={t('common.cancel')}
                            testID="group-picker-close"
                        >
                            <AppIcon name="close" size={22} color={colors.gray500} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingVertical: 4 }}>
                        {groups.map((g, idx) => {
                            const isLast = idx === groups.length - 1;
                            const isSelected = g.id === selectedGroupId;
                            return (
                                <TouchableOpacity
                                    key={g.id}
                                    onPress={() => onSelectGroup(g.id)}
                                    style={rtlRowStyle(isRtl)}
                                    className={`items-center px-4 py-3 ${isLast ? '' : 'border-b border-slate-100'}`}
                                    accessibilityRole="button"
                                    testID={`group-picker-row-${g.id}`}
                                >
                                    <GroupAvatar
                                        imageUrl={g.imageUrl}
                                        groupType={g.groupType}
                                        size="sm"
                                    />
                                    <View style={{ flex: 1, marginHorizontal: 12, minWidth: 0 }}>
                                        <Text
                                            className="text-sm font-medium text-gray-900"
                                            numberOfLines={1}
                                        >
                                            {g.name}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <AppIcon name="checkmark" size={18} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
