/**
 * GroupCard — list row for a group on the GroupsListScreen.
 * Trailing ⋮ opens the full group menu (same actions as GroupDetail).
 * Menu button is a SIBLING of the card press target so web/native both work.
 */

import { Text } from './AppText';
import React, { useCallback, useState } from 'react';
import {
    View,
    TouchableOpacity,
    Modal,
    Pressable,
    Platform,
    ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRtlLayout, rtlRowStyle } from '../hooks/useRtlLayout';
import { useTranslation } from 'react-i18next';
import { GroupRollup, GroupWithMembers } from '@cost-share/shared';
import { AppIcon } from './AppIcon';
import { GroupAvatar } from './GroupAvatar';
import { BalanceChip } from './BalanceChip';
import { HighlightedText } from './HighlightedText';
import { UnreadBadge } from './UnreadBadge';
import { colors } from '../theme';
import { shareGroupInvite } from '../services/invite.service';
import {
    archiveGroup,
    unarchiveGroup,
    deleteGroup,
    removeGroupMember,
} from '../services/groups.service';
import { exportGroupCsv } from '../services/group-share.service';
import { useAppStore } from '../store';
import { confirmSetFavoriteGroup } from '../lib/favoriteGroupMenu';
import { platformAlert } from '../lib/platformAlert';
import { showInfoToast, showSuccessMessage } from '../lib/appToast';

interface GroupCardProps {
    group: GroupWithMembers;
    rollup?: GroupRollup;
    groupHasOpenDebts?: boolean;
    balanceUnknown?: boolean;
    searchQuery?: string;
    matchedMemberNames?: string[];
    unreadCount?: number;
    onPress: (groupId: string) => void;
}

function GroupCardBase({
    group,
    rollup,
    groupHasOpenDebts,
    balanceUnknown,
    searchQuery,
    matchedMemberNames,
    unreadCount,
    onPress,
}: GroupCardProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const navigation = useNavigation<any>();
    const favoriteGroupId = useAppStore(s => s.favoriteGroupId);
    const setFavoriteGroupId = useAppStore(s => s.setFavoriteGroupId);
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const [menuOpen, setMenuOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const memberCount = group.members?.length ?? 0;
    const hasMatches = Boolean(matchedMemberNames && matchedMemberNames.length > 0);
    const isArchived = group.isArchivedByMe || group.isAutoArchived;
    const isFavorite = favoriteGroupId === group.id;
    const hasOpenBalance = groupHasOpenDebts === true;

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const handleShare = useCallback(() => {
        closeMenu();
        void shareGroupInvite(group.id);
    }, [closeMenu, group.id]);

    const handleEdit = useCallback(() => {
        closeMenu();
        navigation.navigate('EditGroup', { groupId: group.id });
    }, [closeMenu, navigation, group.id]);

    const handleFavorite = useCallback(() => {
        closeMenu();
        confirmSetFavoriteGroup({
            groupId: group.id,
            groupName: group.name,
            favoriteGroupId,
            t,
            alert: platformAlert,
            setFavoriteGroupId,
            onApplied: () => showSuccessMessage('groups.favorite.setToast'),
        });
    }, [closeMenu, group.id, group.name, favoriteGroupId, t, setFavoriteGroupId]);

    const handleExport = useCallback(() => {
        closeMenu();
        void (async () => {
            setBusy(true);
            showInfoToast('groups.share.exporting');
            try {
                await exportGroupCsv(group, {
                    feed: [],
                    debts: [],
                    members: group.members ?? [],
                });
            } finally {
                setBusy(false);
            }
        })();
    }, [closeMenu, group]);

    const handleArchiveToggle = useCallback(() => {
        closeMenu();
        if (!group.isArchivedByMe && hasOpenBalance) {
            platformAlert(t('groups.archive.disabledReason'), undefined, [
                { text: t('common.ok'), style: 'default' },
            ]);
            return;
        }
        void (async () => {
            setBusy(true);
            try {
                if (group.isArchivedByMe) {
                    await unarchiveGroup(group.id);
                } else {
                    await archiveGroup(group.id);
                }
            } finally {
                setBusy(false);
            }
        })();
    }, [closeMenu, group.id, group.isArchivedByMe, hasOpenBalance, t]);

    const handleLeave = useCallback(() => {
        closeMenu();
        if (hasOpenBalance) {
            platformAlert(t('groups.archive.disabledReason'), undefined, [
                { text: t('common.ok'), style: 'default' },
            ]);
            return;
        }
        platformAlert(t('groups.leaveGroup'), t('groups.leaveGroupConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('groups.leaveGroup'),
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        if (!currentUserId) return;
                        await removeGroupMember(group.id, currentUserId);
                    })();
                },
            },
        ]);
    }, [closeMenu, hasOpenBalance, t, currentUserId, group.id]);

    const handleDelete = useCallback(() => {
        closeMenu();
        platformAlert(t('groups.deleteGroup'), t('groups.deleteGroupConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    void deleteGroup(group.id);
                },
            },
        ]);
    }, [closeMenu, t, group.id]);

    const cardClass = isArchived
        ? 'bg-slate-50 rounded-2xl p-5 mb-3 border border-dashed border-gray-300'
        : 'bg-white rounded-2xl p-5 mb-3 border border-gray-100';

    return (
        <>
            <View className={cardClass} style={[rtlRowStyle(isRtl), { alignItems: 'center' }]}>
                <TouchableOpacity
                    onPress={() => onPress(group.id)}
                    activeOpacity={0.7}
                    style={{ flex: 1, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', minWidth: 0 }}
                    testID={`group-card-${group.id}`}
                >
                    <View className="mr-4">
                        <GroupAvatar
                            imageUrl={group.imageUrl}
                            groupType={group.groupType}
                            size="md"
                        />
                    </View>

                    <View className="flex-1 mr-2 self-stretch" style={{ minWidth: 0 }}>
                        <View style={[rtlRowStyle(isRtl), { alignItems: 'center' }]}>
                            <View style={{ flexShrink: 1, minWidth: 0 }}>
                                <HighlightedText
                                    className={
                                        isArchived
                                            ? 'text-lg font-semibold text-gray-600'
                                            : 'text-lg font-semibold text-gray-900'
                                    }
                                    text={group.name}
                                    query={searchQuery}
                                    numberOfLines={1}
                                />
                            </View>
                            {!isArchived && (unreadCount ?? 0) > 0 && (
                                <UnreadBadge
                                    count={unreadCount ?? 0}
                                    style={{ marginStart: 8, marginEnd: 4 }}
                                />
                            )}
                            {isArchived && (
                                <View
                                    className="px-2 py-1 rounded-md bg-gray-200"
                                    style={{ marginStart: 'auto', marginEnd: 4 }}
                                    testID="group-archived-badge"
                                >
                                    <Text
                                        className="text-gray-600 font-medium"
                                        style={{ fontSize: 12, letterSpacing: 0.5 }}
                                    >
                                        {t('groups.archive.badge')}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text
                            className={`text-sm mt-1 ${isArchived ? 'text-gray-500' : 'text-gray-400'}`}
                            numberOfLines={1}
                        >
                            {t(`groups.types.${group.groupType}`)}
                            {memberCount > 0
                                ? ` · ${t('groups.memberCount', { count: memberCount })}`
                                : ''}
                        </Text>
                        {hasMatches && (
                            <Text
                                className="text-sm text-gray-500 mt-0.5"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {t('groups.card.matchedMembers', {
                                    names: (matchedMemberNames ?? []).join(', '),
                                })}
                            </Text>
                        )}
                    </View>

                    <BalanceChip
                        rollup={rollup}
                        defaultCurrency={group.defaultCurrency}
                        groupHasOpenDebts={groupHasOpenDebts}
                        balanceUnknown={balanceUnknown}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMenuOpen(true)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('groups.menu.title')}
                    testID={`group-card-menu-${group.id}`}
                    style={{ marginStart: 4, padding: 6 }}
                >
                    <AppIcon name="ellipsis-vertical" size={20} color={colors.gray400} />
                </TouchableOpacity>
            </View>

            <Modal
                visible={menuOpen}
                transparent
                animationType="fade"
                onRequestClose={closeMenu}
            >
                <Pressable
                    className="flex-1 bg-black/30 justify-end"
                    onPress={closeMenu}
                    testID="group-card-menu-backdrop"
                >
                    <Pressable
                        className="bg-white rounded-t-2xl px-2 pt-2"
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            maxHeight: '70%',
                            paddingBottom: Platform.OS === 'ios' ? 28 : 16,
                        }}
                    >
                        <Text className="px-4 py-3 text-base font-semibold text-gray-900">
                            {group.name}
                        </Text>
                        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                            <MenuRow
                                label={t('groups.editGroup')}
                                onPress={handleEdit}
                                testID="group-card-menu-edit"
                            />
                            <MenuRow
                                label={
                                    isFavorite
                                        ? t('groups.favorite.currentLabel')
                                        : t('groups.favorite.setOption')
                                }
                                onPress={handleFavorite}
                                disabled={isFavorite}
                                testID="group-card-menu-favorite"
                            />
                            <MenuRow
                                label={t('groups.share.inviteOption')}
                                onPress={handleShare}
                                testID="group-card-menu-share"
                            />
                            <MenuRow
                                label={t('groups.share.exportOption')}
                                onPress={handleExport}
                                disabled={busy}
                                testID="group-card-menu-export"
                            />
                            <MenuRow
                                label={
                                    group.isArchivedByMe
                                        ? t('groups.archive.unarchiveCta')
                                        : t('groups.archive.archiveCta')
                                }
                                onPress={handleArchiveToggle}
                                disabled={busy}
                                testID="group-card-menu-archive"
                            />
                            <MenuRow
                                label={t('groups.leaveGroup')}
                                onPress={handleLeave}
                                testID="group-card-menu-leave"
                            />
                            <View className="h-px bg-gray-100 my-1 mx-4" />
                            <MenuRow
                                label={t('groups.deleteGroup')}
                                onPress={handleDelete}
                                destructive
                                testID="group-card-menu-delete"
                            />
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

function MenuRow({
    label,
    onPress,
    disabled,
    destructive,
    testID,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    destructive?: boolean;
    testID?: string;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.6}
            className="px-4 py-3.5"
            testID={testID}
        >
            <Text
                className={
                    disabled
                        ? 'text-base text-gray-400'
                        : destructive
                          ? 'text-base text-red-600'
                          : 'text-base text-gray-900'
                }
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export const GroupCard = React.memo(GroupCardBase);
