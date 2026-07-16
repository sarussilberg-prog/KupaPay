/**
 * GroupMembersSheet — bottom sheet listing group members.
 * Tapping the "Add member" row closes this sheet and opens the invite/add flow.
 */
import React from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    Pressable,
    ScrollView,
} from 'react-native';
import { Text } from '../AppText';
import { MemberAvatar } from '../MemberAvatar';
import { AppIcon } from '../AppIcon';
import { GroupMemberLite } from '@cost-share/shared';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme';

interface GroupMembersSheetProps {
    visible: boolean;
    members: GroupMemberLite[];
    onClose: () => void;
    onAddMembers: () => void;
}

export function GroupMembersSheet({
    visible,
    members,
    onClose,
    onAddMembers,
}: GroupMembersSheetProps) {
    const { t } = useTranslation();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
                onPress={onClose}
            >
                <View style={{ flex: 1 }} />
                <Pressable onPress={e => e.stopPropagation()}>
                    <View className="bg-white rounded-t-3xl pt-3 pb-8">
                        <View className="w-10 h-1 rounded-full bg-gray-200 self-center mb-4" />
                        <Text className="text-base font-bold text-gray-900 px-5 mb-2">
                            {t('groups.members.title')}
                        </Text>
                        <ScrollView style={{ maxHeight: 360 }} bounces={false}>
                            {members.map(m => (
                                <View
                                    key={m.userId}
                                    className="flex-row items-center px-5 py-2.5"
                                >
                                    <MemberAvatar
                                        name={m.displayName}
                                        avatarUrl={m.avatarUrl}
                                        size="sm"
                                    />
                                    <Text className="ml-3 text-sm font-medium text-gray-900">
                                        {m.displayName}
                                    </Text>
                                </View>
                            ))}
                            <TouchableOpacity
                                onPress={() => {
                                    onClose();
                                    onAddMembers();
                                }}
                                className="flex-row items-center px-5 py-3 mt-1 border-t border-gray-100"
                                accessibilityRole="button"
                                testID="members-sheet-add-btn"
                            >
                                <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                                    <AppIcon name="add" size={18} color={colors.gray500} />
                                </View>
                                <Text className="ml-3 text-sm font-medium text-primary">
                                    {t('groups.members.addMembers')}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
