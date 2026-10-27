import React, { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ProUpsellButton } from '../pro/ProUpsellButton';
import { useTranslation } from 'react-i18next';
type BudgetExpenseRow = {
    amount: number;
    currency: string;
    isDeleted: boolean;
};
import { Text } from '../AppText';
import { fetchGroupTripBudget, type TripBudgetSettings } from '../../services/tripBudget.service';
import { TripBudgetSheet } from './TripBudgetSheet';
import { captureProductEvent } from '../../lib/productAnalytics';

interface TripBudgetSectionProps {
    groupId: string;
    defaultCurrency: string;
    expenses: BudgetExpenseRow[];
    unlocked: boolean;
    onUpgrade: () => void;
}

function sumExpensesInCurrency(expenses: BudgetExpenseRow[], currency: string): number {
    return expenses
        .filter(e => !e.isDeleted && e.currency === currency)
        .reduce((acc, e) => acc + e.amount, 0);
}

export function TripBudgetSection({
    groupId,
    defaultCurrency,
    expenses,
    unlocked,
    onUpgrade,
}: TripBudgetSectionProps) {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<TripBudgetSettings | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const reload = () => {
        void fetchGroupTripBudget(groupId).then(row => {
            if (row) setSettings(row);
        });
    };

    useEffect(() => {
        reload();
    }, [groupId]);

    const budgetCurrency = settings?.currency ?? defaultCurrency;
    const budgetAmount = settings?.amount ?? null;
    const spent = useMemo(
        () => sumExpensesInCurrency(expenses, budgetCurrency),
        [expenses, budgetCurrency],
    );

    const pct =
        budgetAmount && budgetAmount > 0
            ? Math.min(100, Math.round((spent / budgetAmount) * 100))
            : 0;

    useEffect(() => {
        if (!unlocked || !budgetAmount) return;
        void captureProductEvent('trip_budget_viewed', {
            group_id: groupId,
            percent_used: pct,
        });
        void import('../../services/proTrialFeatureTouch.service').then(m =>
            m.touchProTrialFeature({ tripBudget: true }),
        );
    }, [unlocked, budgetAmount, groupId, pct]);

    if (!unlocked) {
        return (
            <View className="mx-4 mb-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <Text className="text-gray-800 font-semibold mb-1">{t('pro.tripBudget.title')}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t('pro.tripBudget.lockedBody')}</Text>
                <ProUpsellButton
                    groupId={groupId}
                    title={t('pro.tripBudget.upgrade')}
                    onPress={onUpgrade}
                    testID="trip-budget-upgrade"
                />
            </View>
        );
    }

    return (
        <>
            <View className="mx-4 mb-3 p-4 rounded-2xl bg-white border border-gray-100">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-900 font-semibold">{t('pro.tripBudget.title')}</Text>
                    <TouchableOpacity onPress={() => setSheetOpen(true)} accessibilityRole="button">
                        <Text className="text-primary font-medium text-sm">
                            {budgetAmount ? t('pro.tripBudget.edit') : t('pro.tripBudget.set')}
                        </Text>
                    </TouchableOpacity>
                </View>
                {budgetAmount ? (
                    <>
                        <Text className="text-gray-600 text-sm mb-2">
                            {t('pro.tripBudget.progress', {
                                spent: spent.toFixed(2),
                                budget: budgetAmount.toFixed(2),
                                currency: budgetCurrency,
                                percent: pct,
                            })}
                        </Text>
                        <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <View
                                className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${pct}%` }}
                            />
                        </View>
                    </>
                ) : (
                    <Text className="text-gray-500 text-sm">{t('pro.tripBudget.emptyHint')}</Text>
                )}
            </View>
            <TripBudgetSheet
                visible={sheetOpen}
                groupId={groupId}
                defaultCurrency={defaultCurrency}
                initialAmount={budgetAmount}
                initialCurrency={budgetCurrency}
                onClose={() => setSheetOpen(false)}
                onSaved={() => {
                    reload();
                    setSheetOpen(false);
                }}
            />
        </>
    );
}
