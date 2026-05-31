/**
 * GroupTotalsCard — top of the Balances screen. Three stats:
 *   1. Total spent (per currency)
 *   2. Unsettled (per currency)
 *   3. Expense count — rendered as the pluralised "N expenses" line.
 *
 * Currencies are sorted with the group's default first via
 * sortCurrencyAmounts. The Unsettled row renders the
 * CurrencyAmountList empty-state when nothing is unsettled.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CurrencyAmount, sortCurrencyAmounts } from '@cost-share/shared';
import { Text } from '../AppText';
import { CurrencyAmountList } from './CurrencyAmountList';

interface GroupTotalsCardProps {
    totalSpent: CurrencyAmount[];
    unsettled: CurrencyAmount[];
    expenseCount: number;
    defaultCurrency: string;
}

export function GroupTotalsCard({
    totalSpent,
    unsettled,
    expenseCount,
    defaultCurrency,
}: GroupTotalsCardProps) {
    const { t } = useTranslation();

    const sortedSpent = useMemo(
        () => sortCurrencyAmounts(totalSpent, defaultCurrency),
        [totalSpent, defaultCurrency],
    );
    const sortedUnsettled = useMemo(
        () => sortCurrencyAmounts(unsettled, defaultCurrency),
        [unsettled, defaultCurrency],
    );

    return (
        <View
            className="bg-white rounded-xl px-4 py-3"
            testID="group-totals-card"
        >
            <Text className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                {t('balances.groupTotals')}
            </Text>

            <View className="flex-row items-start justify-between py-2">
                <Text className="text-sm text-gray-600">
                    {t('balances.totalSpent')}
                </Text>
                <View className="items-end">
                    <CurrencyAmountList
                        amounts={sortedSpent}
                        textClassName="text-sm font-semibold text-gray-900"
                    />
                </View>
            </View>

            <View className="h-px bg-slate-100" />

            <View className="flex-row items-start justify-between py-2">
                <Text className="text-sm text-gray-600">
                    {t('balances.unsettled')}
                </Text>
                <View className="items-end">
                    <CurrencyAmountList
                        amounts={sortedUnsettled}
                        textClassName="text-sm font-semibold text-gray-900"
                    />
                </View>
            </View>

            <View className="h-px bg-slate-100" />

            <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-gray-600">
                    {t('balances.expenseCount', { count: expenseCount })}
                </Text>
            </View>
        </View>
    );
}
