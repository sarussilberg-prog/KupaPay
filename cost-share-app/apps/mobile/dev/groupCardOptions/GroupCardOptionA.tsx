/**
 * Option A — footer balance: name/meta on top, full-width divider, centered BalanceChip below.
 */

import React from 'react';
import { View } from 'react-native';
import { BalanceChip } from '../../components/BalanceChip';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import {
    GroupCardOptionHeaderRow,
    GroupCardOptionMenuStub,
    GroupCardOptionProps,
    previewCardShadow,
} from './groupCardOptionShared';

export function GroupCardOptionA({
    group,
    rollup,
    groupHasOpenDebts,
    balanceUnknown,
    unreadCount,
    onPress,
}: GroupCardOptionProps) {
    const isRtl = useRtlLayout();
    const isArchived = group.isArchivedByMe || group.isAutoArchived;
    const shellClass = isArchived
        ? 'bg-slate-50 dark:bg-gray-800/60 rounded-2xl mb-3 border border-dashed border-gray-300 dark:border-gray-600 overflow-hidden'
        : 'bg-white dark:bg-gray-800 rounded-2xl mb-3 border border-gray-100 dark:border-gray-700 overflow-hidden';

    return (
        <View
            className={shellClass}
            style={previewCardShadow(isArchived)}
            testID={`group-card-option-a-${group.id}`}
        >
            <View className="px-4 pt-3 pb-2" style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
                <GroupCardOptionHeaderRow
                    group={group}
                    isArchived={isArchived}
                    unreadCount={unreadCount}
                    onPress={onPress}
                    testID={`group-card-option-a-row-${group.id}`}
                />
                <GroupCardOptionMenuStub groupId={group.id} />
            </View>
            <View className="h-px bg-gray-100 dark:bg-gray-700 mx-4" />
            <View className="px-4 py-2.5 items-center">
                <BalanceChip
                    rollup={rollup}
                    defaultCurrency={group.defaultCurrency}
                    groupHasOpenDebts={groupHasOpenDebts}
                    balanceUnknown={balanceUnknown}
                />
            </View>
        </View>
    );
}
