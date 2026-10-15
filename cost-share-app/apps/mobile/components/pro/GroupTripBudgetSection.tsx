/**
 * Pro: set a group trip budget and show spend progress.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ExpenseWithSplits } from '@cost-share/shared';
import { Text } from '../AppText';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { sumExpensesInCurrency, tripBudgetPercent } from '../../lib/tripBudget';
import {
    fetchGroupTripBudget,
    setGroupTripBudget,
} from '../../services/tripBudget.service';
import { CurrencyPicker } from '../CurrencyPicker';
import { useRtlLayout, rtlTextClassName } from '../../hooks/useRtlLayout';

interface GroupTripBudgetSectionProps {
    groupId: string;
    defaultCurrency: string;
    unlocked: boolean;
    expenses: ExpenseWithSplits[];
    onUpgrade: () => void;
}

export function GroupTripBudgetSection({
    groupId,
    defaultCurrency,
    unlocked,
    expenses,
    onUpgrade,
}: GroupTripBudgetSectionProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const [budget, setBudget] = useState<{ amount: number | null; currency: string | null }>({
        amount: null,
        currency: null,
    });
    const [draftAmount, setDraftAmount] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void fetchGroupTripBudget(groupId).then(b => {
            setBudget(b);
            if (b.currency) setCurrency(b.currency);
            if (b.amount != null) setDraftAmount(String(b.amount));
        });
    }, [groupId]);

    const spent = useMemo(() => {
        if (!budget.currency) return 0;
        return sumExpensesInCurrency(
            expenses.map(e => ({ amount: e.amount, currency: e.currency, isDeleted: e.isDeleted })),
            budget.currency,
        );
    }, [budget.currency, expenses]);

    const pct = budget.amount ? tripBudgetPercent(spent, budget.amount) : 0;

    const save = useCallback(async () => {
        if (!unlocked) {
            onUpgrade();
            return;
        }
        const amount = Number(draftAmount.replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            setSaving(true);
            const ok = await setGroupTripBudget(groupId, null, null);
            setSaving(false);
            if (ok) setBudget({ amount: null, currency: null });
            return;
        }
        setSaving(true);
        const ok = await setGroupTripBudget(groupId, amount, currency);
        setSaving(false);
        if (ok) setBudget({ amount, currency });
    }, [currency, draftAmount, groupId, onUpgrade, unlocked]);

    if (!KUPAPAY_PRO_ENABLED) return null;

    if (!unlocked) {
        return (
            <View className="mx-4 mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <Text className="text-gray-800 font-semibold mb-1">{t('pro.tripBudget.title')}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t('pro.tripBudget.lockedBody')}</Text>
                <TouchableOpacity onPress={onUpgrade} className="bg-primary rounded-xl py-3 items-center">
                    <Text className="text-white font-semibold">{t('pro.tripCurrency.upgrade')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-white border border-gray-100">
            <Text className="text-gray-900 font-semibold mb-1">{t('pro.tripBudget.title')}</Text>
            <Text className="text-gray-600 text-sm mb-3">{t('pro.tripBudget.body')}</Text>
            <View className="flex-row gap-2 mb-3">
                <TextInput
                    value={draftAmount}
                    onChangeText={setDraftAmount}
                    keyboardType="decimal-pad"
                    placeholder={t('pro.tripBudget.amountPlaceholder')}
                    className={`flex-1 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 ${rtlTextClassName(isRtl)}`}
                />
                <TouchableOpacity
                    onPress={() => setPickerOpen(true)}
                    className="border border-gray-200 rounded-xl px-4 justify-center"
                >
                    <Text className="text-gray-800 font-medium">{currency}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                disabled={saving}
                onPress={() => void save()}
                className="bg-primary rounded-xl py-3 items-center mb-3"
            >
                <Text className="text-white font-semibold">{t('pro.tripBudget.save')}</Text>
            </TouchableOpacity>
            {budget.amount != null && budget.currency && (
                <>
                    <View className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
                        <View
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                        />
                    </View>
                    <Text className="text-sm text-gray-700">
                        {t('pro.tripBudget.progress', {
                            spent,
                            budget: budget.amount,
                            currency: budget.currency,
                            percent: Math.round(pct),
                        })}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">{t('pro.tripBudget.alertNote')}</Text>
                </>
            )}
            <CurrencyPicker
                value={currency}
                onChange={setCurrency}
                visible={pickerOpen}
                onClose={() => setPickerOpen(false)}
            />
        </View>
    );
}
