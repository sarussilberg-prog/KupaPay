/**
 * Pro: category / member / time spending charts for one group.
 */

import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ExpenseWithSplits } from '@cost-share/shared';
import { CenterDialogShell } from '../CenterDialogShell';
import { Text } from '../AppText';
import {
    aggregateSpendingByCategory,
    aggregateSpendingByMember,
    aggregateSpendingOverTime,
    maxInsightTotal,
} from '../../lib/spendingInsights';

interface GroupSpendingInsightsSheetProps {
    visible: boolean;
    onClose: () => void;
    unlocked: boolean;
    onUpgrade: () => void;
    defaultCurrency: string;
    expenses: ExpenseWithSplits[];
    memberNames: Record<string, string>;
}

function InsightBars({
    rows,
    labelForKey,
}: {
    rows: Array<{ key: string; total: number; currency: string }>;
    labelForKey: (key: string) => string;
}) {
    const max = maxInsightTotal(rows);
    return (
        <View className="gap-2">
            {rows.slice(0, 8).map(row => (
                <View key={row.key}>
                    <View className="flex-row justify-between mb-1">
                        <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                            {labelForKey(row.key)}
                        </Text>
                        <Text className="text-sm font-semibold text-gray-900">
                            {row.total.toFixed(2)} {row.currency}
                        </Text>
                    </View>
                    <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <View
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }}
                        />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function GroupSpendingInsightsSheet({
    visible,
    onClose,
    unlocked,
    onUpgrade,
    defaultCurrency,
    expenses,
    memberNames,
}: GroupSpendingInsightsSheetProps) {
    const { t } = useTranslation();

    const insightRows = useMemo(
        () =>
            expenses.map(e => ({
                amount: e.amount,
                currency: e.currency,
                category: e.category,
                expenseDate: e.expenseDate,
                paidBy: e.paidBy,
            })),
        [expenses],
    );

    const byCategory = useMemo(
        () => aggregateSpendingByCategory(insightRows, defaultCurrency),
        [insightRows, defaultCurrency],
    );
    const byMember = useMemo(
        () => aggregateSpendingByMember(insightRows, defaultCurrency),
        [insightRows, defaultCurrency],
    );
    const overTime = useMemo(
        () => aggregateSpendingOverTime(insightRows, defaultCurrency),
        [insightRows, defaultCurrency],
    );

    const categoryLabel = (key: string) => t(`expenses.categories.${key}`, key);

    return (
        <CenterDialogShell visible={visible} onClose={onClose} label={t('pro.insights.title')}>
            <ScrollView className="max-h-[70vh] px-2 pb-4">
                {!unlocked ? (
                    <View className="p-4 rounded-2xl bg-amber-50 border border-amber-100 mb-4">
                        <Text className="text-gray-800 font-semibold mb-1">{t('pro.insights.title')}</Text>
                        <Text className="text-gray-600 text-sm mb-3">{t('pro.insights.lockedBody')}</Text>
                        <TouchableOpacity onPress={onUpgrade} className="bg-primary rounded-xl py-3 items-center">
                            <Text className="text-white font-semibold">{t('pro.tripCurrency.upgrade')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <Text className="text-xs text-gray-500 mb-4">{t('pro.insights.currencyNote', { currency: defaultCurrency })}</Text>
                        <Text className="text-base font-semibold text-gray-900 mb-2">{t('pro.insights.byCategory')}</Text>
                        {byCategory.length === 0 ? (
                            <Text className="text-sm text-gray-500 mb-4">{t('pro.insights.empty')}</Text>
                        ) : (
                            <InsightBars rows={byCategory} labelForKey={categoryLabel} />
                        )}
                        <Text className="text-base font-semibold text-gray-900 mt-6 mb-2">{t('pro.insights.byMember')}</Text>
                        <InsightBars rows={byMember} labelForKey={id => memberNames[id] ?? '—'} />
                        <Text className="text-base font-semibold text-gray-900 mt-6 mb-2">{t('pro.insights.overTime')}</Text>
                        <InsightBars rows={overTime.map(r => ({ key: r.label, ...r }))} labelForKey={k => k} />
                    </>
                )}
            </ScrollView>
        </CenterDialogShell>
    );
}
