/**
 * Option B — inline balance: compact row, amount + caption as plain text (no chip box).
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import {
    balanceChipLabelKey,
    classifyUserNetBalance,
    countNonZeroCurrencyOthers,
    formatGroupsListAmount,
    wrapLtrForBidi,
} from '@cost-share/shared';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { BalanceChip } from '../../components/BalanceChip';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import {
    GroupCardOptionHeaderRow,
    GroupCardOptionMenuStub,
    GroupCardOptionProps,
    previewCardShadow,
} from './groupCardOptionShared';

const amountToneClass = {
    settled: 'text-sm font-semibold text-gray-500 dark:text-gray-400',
    owe: 'text-sm font-bold text-red-600 dark:text-red-400',
    owed: 'text-sm font-bold text-emerald-700 dark:text-emerald-400',
    unknown: 'text-sm font-medium text-gray-400 dark:text-gray-500',
} as const;

const captionToneClass = {
    settled: 'text-[11px] font-medium text-gray-500 dark:text-gray-400',
    owe: 'text-[11px] font-medium text-red-700/90 dark:text-red-300',
    owed: 'text-[11px] font-medium text-emerald-800/90 dark:text-emerald-300',
    unknown: 'text-[11px] font-medium text-gray-400 dark:text-gray-500',
} as const;

function InlineBalance({
    rollup,
    defaultCurrency,
    groupHasOpenDebts,
    balanceUnknown,
}: Pick<
    GroupCardOptionProps,
    'rollup' | 'groupHasOpenDebts' | 'balanceUnknown'
> & { defaultCurrency: string }) {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const primary = rollup?.primary;
    const extraCount = countNonZeroCurrencyOthers(rollup?.others);
    const hasRealBalance = primary && Math.abs(primary.net) >= 0.01;

    const tone = useMemo(() => {
        if (!hasRealBalance && balanceUnknown) return 'unknown' as const;
        if (!hasRealBalance) return 'settled' as const;
        return classifyUserNetBalance(primary!.net);
    }, [balanceUnknown, hasRealBalance, primary]);

    const textAlign = isRtl ? 'left' : 'right';

    if (tone === 'settled' || tone === 'unknown') {
        return (
            <View style={{ alignItems: isRtl ? 'flex-start' : 'flex-end', maxWidth: 120, gap: 2 }}>
                <Text className={captionToneClass[tone]} style={{ textAlign }}>
                    {t(balanceChipLabelKey(tone, groupHasOpenDebts))}
                </Text>
            </View>
        );
    }

    const currency = primary?.currency || defaultCurrency;
    const amountText = formatGroupsListAmount(primary!.net, currency, { language: i18n.language });
    const extraLabel =
        extraCount > 0
            ? wrapLtrForBidi(t('groups.card.moreCurrencies', { count: extraCount }))
            : null;

    return (
        <View style={{ alignItems: isRtl ? 'flex-start' : 'flex-end', maxWidth: 120, gap: 1 }}>
            <Text
                className={amountToneClass[tone]}
                style={{ textAlign, writingDirection: 'ltr' }}
                testID="group-card-option-b-amount"
            >
                {amountText}
            </Text>
            <Text className={captionToneClass[tone]} style={{ textAlign }} numberOfLines={2}>
                {t(balanceChipLabelKey(tone, groupHasOpenDebts))}
            </Text>
            {extraLabel ? (
                <Text className={captionToneClass[tone]} style={{ textAlign }} numberOfLines={2}>
                    {extraLabel}
                </Text>
            ) : null}
        </View>
    );
}

export function GroupCardOptionB({
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
        ? 'bg-slate-50 dark:bg-gray-800/60 rounded-2xl px-4 py-3 mb-3 border border-dashed border-gray-300 dark:border-gray-600'
        : 'bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 mb-3 border border-gray-100 dark:border-gray-700';

    const primary = rollup?.primary;
    const hasRealBalance = primary && Math.abs(primary.net) >= 0.01;
    const showInline = hasRealBalance || balanceUnknown;

    return (
        <View
            className={shellClass}
            style={[previewCardShadow(isArchived), { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center' }]}
            testID={`group-card-option-b-${group.id}`}
        >
            <GroupCardOptionHeaderRow
                group={group}
                isArchived={isArchived}
                unreadCount={unreadCount}
                onPress={onPress}
                testID={`group-card-option-b-row-${group.id}`}
            />
            {showInline ? (
                <InlineBalance
                    rollup={rollup}
                    defaultCurrency={group.defaultCurrency}
                    groupHasOpenDebts={groupHasOpenDebts}
                    balanceUnknown={balanceUnknown}
                />
            ) : (
                <BalanceChip
                    rollup={rollup}
                    defaultCurrency={group.defaultCurrency}
                    groupHasOpenDebts={groupHasOpenDebts}
                    balanceUnknown={balanceUnknown}
                />
            )}
            <GroupCardOptionMenuStub groupId={group.id} />
        </View>
    );
}
