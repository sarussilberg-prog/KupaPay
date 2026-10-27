/**
 * Shared pieces for dev-only group card design previews (not used in production list).
 */

import React from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import type { GroupRollup, GroupWithMembers } from '@cost-share/shared';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/AppIcon';
import { GroupAvatar } from '../../components/GroupAvatar';
import { Text } from '../../components/AppText';
import { HighlightedText } from '../../components/HighlightedText';
import { GroupCardMetaLine } from '../../components/GroupCardMetaLine';
import { UnreadBadge } from '../../components/UnreadBadge';
import { ListRow } from '../../components/primitives/ListRow';
import { colors } from '../../theme';
import { rtlRowStyle, useRtlLayout } from '../../hooks/useRtlLayout';

export type GroupCardOptionProps = {
    group: GroupWithMembers;
    rollup?: GroupRollup;
    groupHasOpenDebts?: boolean;
    balanceUnknown?: boolean;
    unreadCount?: number;
    onPress: (groupId: string) => void;
};

export function previewCardShadow(isArchived: boolean): object | undefined {
    if (isArchived || Platform.OS !== 'web') {
        return Platform.OS === 'web' && !isArchived
            ? ({ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)' } as const)
            : undefined;
    }
    return Platform.select({
        ios: {
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
        },
        android: { elevation: 2 },
    });
}

export function GroupCardOptionMenuStub({ groupId }: { groupId: string }) {
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('groups.menu.title')}
            testID={`group-card-option-menu-${groupId}`}
            style={{ padding: 6, alignSelf: 'center' }}
        >
            <AppIcon name="ellipsis-vertical" size={16} color={colors.gray400} />
        </TouchableOpacity>
    );
}

export function GroupCardOptionHeaderRow({
    group,
    isArchived,
    unreadCount,
    onPress,
    testID,
    children,
}: {
    group: GroupWithMembers;
    isArchived: boolean;
    unreadCount?: number;
    onPress: (groupId: string) => void;
    testID: string;
    children?: React.ReactNode;
}) {
    const isRtl = useRtlLayout();
    const { i18n, t } = useTranslation();

    return (
        <ListRow
            onPress={() => onPress(group.id)}
            testID={testID}
            style={{ flex: 1, alignItems: 'center', gap: 14, minWidth: 0 }}
        >
            <GroupAvatar
                imageUrl={group.imageUrl}
                groupType={group.groupType}
                name={group.name}
                size="sm"
            />
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={[rtlRowStyle(isRtl), { alignItems: 'center', gap: 6 }]}>
                    <View style={{ flexShrink: 1, minWidth: 0 }}>
                        <HighlightedText
                            className={
                                isArchived
                                    ? 'text-[17px] font-semibold text-gray-600 dark:text-gray-300 leading-5'
                                    : 'text-[17px] font-semibold text-gray-900 dark:text-gray-50 leading-5'
                            }
                            text={group.name}
                        />
                    </View>
                    {!isArchived && (unreadCount ?? 0) > 0 && (
                        <UnreadBadge count={unreadCount ?? 0} />
                    )}
                    {isArchived && (
                        <View
                            className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-600"
                            style={{ marginStart: 'auto' }}
                            testID="group-archived-badge"
                        >
                            <Text className="text-gray-600 dark:text-gray-200 font-medium" style={{ fontSize: 11 }}>
                                {t('groups.archive.badge')}
                            </Text>
                        </View>
                    )}
                </View>
                <GroupCardMetaLine
                    group={group}
                    memberCount={group.members?.length ?? 0}
                    language={i18n.language}
                />
            </View>
            {children}
        </ListRow>
    );
}
