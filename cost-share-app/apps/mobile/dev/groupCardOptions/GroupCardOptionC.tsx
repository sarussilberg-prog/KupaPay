/**
 * Option C — side panel: main column + tinted trailing panel with BalanceChip.
 */

import React from 'react';
import { View } from 'react-native';
import {
    classifyUserNetBalance,
    type GroupRollup,
} from '@cost-share/shared';
import { BalanceChip } from '../../components/BalanceChip';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import {
    GroupCardOptionHeaderRow,
    GroupCardOptionMenuStub,
    GroupCardOptionProps,
    previewCardShadow,
} from './groupCardOptionShared';

function panelToneClass(rollup?: GroupRollup, balanceUnknown?: boolean): string {
    const primary = rollup?.primary;
    const hasRealBalance = primary && Math.abs(primary.net) >= 0.01;
    if (!hasRealBalance && balanceUnknown) {
        return 'bg-gray-50 dark:bg-gray-700/40';
    }
    if (!hasRealBalance) {
        return 'bg-gray-50 dark:bg-gray-700/30';
    }
    const tone = classifyUserNetBalance(primary!.net);
    if (tone === 'owe') return 'bg-red-50/80 dark:bg-red-950/30';
    if (tone === 'owed') return 'bg-emerald-50/80 dark:bg-emerald-950/30';
    return 'bg-gray-50 dark:bg-gray-700/30';
}

export function GroupCardOptionC({
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

    const panelClass = panelToneClass(rollup, balanceUnknown);

    return (
        <View
            className={shellClass}
            style={[
                previewCardShadow(isArchived),
                { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'stretch' },
            ]}
            testID={`group-card-option-c-${group.id}`}
        >
            <View
                style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    paddingStart: 16,
                    paddingVertical: 12,
                }}
            >
                <GroupCardOptionHeaderRow
                    group={group}
                    isArchived={isArchived}
                    unreadCount={unreadCount}
                    onPress={onPress}
                    testID={`group-card-option-c-row-${group.id}`}
                />
                <GroupCardOptionMenuStub groupId={group.id} />
            </View>
            <View
                className={`${panelClass} px-3 py-3 justify-center border-s border-gray-200/80 dark:border-gray-600/80`}
                style={{ maxWidth: 132 }}
            >
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
