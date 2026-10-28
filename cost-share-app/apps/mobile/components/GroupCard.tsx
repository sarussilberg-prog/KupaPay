/**
 * GroupCard — list row for a group on the GroupsListScreen.
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
    useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRtlLayout, rtlRowStyle, rtlTextClassName } from '../hooks/useRtlLayout';
import { useTranslation } from 'react-i18next';
import { GroupRollup, GroupWithMembers, type RatesFromBase } from '@cost-share/shared';
import { AppIcon } from './AppIcon';
import { GroupAvatar } from './GroupAvatar';
import { BalanceChip } from './BalanceChip';
import { HighlightedText } from './HighlightedText';
import { UnreadBadge } from './UnreadBadge';
import { IconLabel } from './primitives/IconLabel';
import { GroupCardMetaLine } from './GroupCardMetaLine';
import { ListRow } from './primitives/ListRow';
import { colors } from '../theme';
import { shareGroupBalanceLink, shareGroupInvite } from '../services/invite.service';
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
import {
    GROUP_CARD_CHIP_MAX_WIDTH,
    GROUP_CARD_MENU_HIT,
    GROUP_CARD_MENU_ICON,
    GROUP_CARD_PAD,
    GROUP_CARD_ROW_GAP,
    GROUP_CARD_STACK_CHIP_MAX_WIDTH,
    GROUP_CARD_STACK_GAP,
    GROUP_CARD_TEXT_GAP,
} from './groupCardLayout';

interface GroupCardProps {
    group: GroupWithMembers;
    rollup?: GroupRollup;
    groupHasOpenDebts?: boolean;
    balanceUnknown?: boolean;
    searchQuery?: string;
    matchedMemberNames?: string[];
    unreadCount?: number;
    displayCurrency?: string;
    ratesFromBase?: RatesFromBase;
    onPress: (groupId: string) => void;
    showOverflowMenu?: boolean;
    showTrailingChevron?: boolean;
}

function GroupCardBase({
    group,
    rollup,
    groupHasOpenDebts,
    balanceUnknown,
    searchQuery,
    matchedMemberNames,
    unreadCount,
    displayCurrency,
    ratesFromBase,
    onPress,
    showOverflowMenu = true,
    showTrailingChevron = false,
}: GroupCardProps) {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const navigation = useNavigation<any>();
    const favoriteGroupId = useAppStore(s => s.favoriteGroupId);
    const setFavoriteGroupId = useAppStore(s => s.setFavoriteGroupId);
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const [menuOpen, setMenuOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const { width: windowWidth } = useWindowDimensions();
    const stackBalanceChip = windowWidth <= GROUP_CARD_STACK_CHIP_MAX_WIDTH;
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

    const handleShareBalance = useCallback(() => {
        closeMenu();
        void shareGroupBalanceLink(group.id);
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

    const openBalances = useCallback(() => {
        navigation.navigate('Balances', { groupId: group.id });
    }, [navigation, group.id]);

    const cardClass = isArchived
        ? 'bg-slate-50 dark:bg-gray-800/60 rounded-2xl mb-2 border border-dashed border-gray-300 dark:border-gray-600'
        : 'bg-white dark:bg-gray-800 rounded-2xl mb-2 border border-gray-100 dark:border-gray-700';

    const balanceChipNode = (
        <BalanceChip
            rollup={rollup}
            defaultCurrency={group.defaultCurrency}
            displayCurrency={displayCurrency}
            ratesFromBase={ratesFromBase}
            groupHasOpenDebts={groupHasOpenDebts}
            balanceUnknown={balanceUnknown}
            onPressExtraCurrencies={openBalances}
        />
    );

    const cardShadow =
        isArchived || Platform.OS === 'web'
            ? Platform.OS === 'web' && !isArchived
                ? ({ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)' } as const)
                : undefined
            : Platform.select({
                  ios: {
                      shadowColor: '#0f172a',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.06,
                      shadowRadius: 6,
                  },
                  android: { elevation: 2 },
              });

    const titleClassName = isArchived
        ? 'text-[17px] font-semibold text-gray-600 dark:text-gray-300 leading-5'
        : 'text-[17px] font-semibold text-gray-900 dark:text-gray-50 leading-5';
    const titleAlignClass = rtlTextClassName(isRtl, titleClassName);

    return (
        <>
            <View
                className={cardClass}
                style={[
                    rtlRowStyle(isRtl),
                    {
                        alignItems: 'center',
                        padding: GROUP_CARD_PAD,
                        gap: GROUP_CARD_STACK_GAP,
                    },
                    cardShadow,
                ]}
            >
                <ListRow
                    onPress={() => onPress(group.id)}
                    testID={`group-card-${group.id}`}
                    style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: GROUP_CARD_ROW_GAP,
                        minWidth: 0,
                    }}
                >
                    <GroupAvatar
                        imageUrl={group.imageUrl}
                        groupType={group.groupType}
                        name={group.name}
                        size="sm"
                        style={{ flexShrink: 0 }}
                    />

                    <View
                        style={{
                            flex: 1,
                            minWidth: 0,
                            gap: GROUP_CARD_TEXT_GAP,
                            justifyContent: 'center',
                        }}
                    >
                        <View style={[rtlRowStyle(isRtl), { alignItems: 'center', gap: 8, minWidth: 0 }]}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <HighlightedText
                                    className={`${titleClassName} ${titleAlignClass}`}
                                    text={group.name}
                                    query={searchQuery}
                                    numberOfLines={1}
                                />
                            </View>
                            {!isArchived && (unreadCount ?? 0) > 0 && (
                                <UnreadBadge count={unreadCount ?? 0} />
                            )}
                            {isArchived && (
                                <View
                                    className="px-2 py-0.5 rounded-md bg-gray-200"
                                    style={{ marginStart: 'auto' }}
                                    testID="group-archived-badge"
                                >
                                    <Text className="text-gray-600 font-medium" style={{ fontSize: 11 }}>
                                        {t('groups.archive.badge')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <GroupCardMetaLine
                            group={group}
                            memberCount={memberCount}
                            language={i18n.language}
                        />
                        {hasMatches && (
                            <IconLabel
                                label={t('groups.card.matchedMembers', {
                                    names: (matchedMemberNames ?? []).join(', '),
                                })}
                                tone="default"
                            />
                        )}
                        {stackBalanceChip ? (
                            <View
                                style={{
                                    alignSelf: isRtl ? 'flex-start' : 'flex-end',
                                    marginTop: 2,
                                }}
                            >
                                {balanceChipNode}
                            </View>
                        ) : null}
                    </View>

                    {!stackBalanceChip ? (
                        <View style={{ flexShrink: 0, flexGrow: 0, maxWidth: GROUP_CARD_CHIP_MAX_WIDTH }}>
                            {balanceChipNode}
                        </View>
                    ) : null}
                </ListRow>

                {showTrailingChevron ? (
                    <View style={{ flexShrink: 0 }}>
                        <AppIcon
                            name={isRtl ? 'chevron-back' : 'chevron-forward'}
                            size={20}
                            color={colors.gray300}
                        />
                    </View>
                ) : null}

                {showOverflowMenu ? (
                    <TouchableOpacity
                        onPress={() => setMenuOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('groups.menu.title')}
                        testID={`group-card-menu-${group.id}`}
                        style={{
                            width: GROUP_CARD_MENU_HIT,
                            height: GROUP_CARD_MENU_HIT,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <AppIcon
                            name="ellipsis-vertical"
                            size={GROUP_CARD_MENU_ICON}
                            color={colors.gray400}
                        />
                    </TouchableOpacity>
                ) : null}
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
                                label={t('groups.share.balanceLinkOption')}
                                onPress={handleShareBalance}
                                testID="group-card-menu-share-balance"
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
