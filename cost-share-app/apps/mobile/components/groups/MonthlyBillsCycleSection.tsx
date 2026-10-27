import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { expenseInMonthlyCycle } from '@cost-share/shared';
import { useProStatusQuery } from '../../hooks/queries/useProStatusQuery';
import { useNavigation } from '@react-navigation/native';

type CycleExpenseRow = {
    amount: number;
    currency: string;
    isDeleted: boolean;
    expenseDate: Date;
};

type Props = {
    groupId: string;
    cycleDay: number;
    expenses: CycleExpenseRow[];
    currency: string;
};

export function MonthlyBillsCycleSection({ groupId, cycleDay, expenses, currency }: Props) {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { proPerkUnlocked: proUnlocked } = useProStatusQuery(groupId);

    const cycleExpenses = useMemo(
        () => expenses.filter(e => !e.isDeleted && expenseInMonthlyCycle(e.expenseDate, cycleDay)),
        [expenses, cycleDay],
    );

    const total = useMemo(
        () => cycleExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
        [cycleExpenses],
    );

    if (cycleExpenses.length === 0) return null;

    return (
        <View className="mx-4 mt-3 rounded-xl bg-white border border-slate-200 p-4" testID="monthly-bills-cycle">
            <Text className="text-gray-900 font-semibold">{t('groups.monthlyBills.title')}</Text>
            <Text className="text-gray-600 text-sm mt-1">
                {t('groups.monthlyBills.summary', {
                    count: cycleExpenses.length,
                    total: total.toFixed(2),
                    currency,
                })}
            </Text>
            <Text className="text-gray-500 text-xs mt-2">
                {t('groups.monthlyBills.cycleDay', { day: cycleDay })}
            </Text>
            {!proUnlocked ? (
                <Pressable
                    className="mt-3"
                    onPress={() => navigation.navigate('Paywall', { featureKey: 'recurring', groupId })}
                    accessibilityRole="button"
                >
                    <Text className="text-primary-600 text-sm font-medium">
                        {t('groups.monthlyBills.automationPro')}
                    </Text>
                </Pressable>
            ) : (
                <Text className="text-gray-500 text-xs mt-3">{t('groups.monthlyBills.automationActive')}</Text>
            )}
        </View>
    );
}
