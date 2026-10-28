import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
import { Input } from '../Input';
import { CurrencyPicker } from '../CurrencyPicker';
import { setGroupTripBudget } from '../../services/tripBudget.service';
import { captureProductEvent } from '../../lib/productAnalytics';

interface TripBudgetSheetProps {
    visible: boolean;
    groupId: string;
    defaultCurrency: string;
    initialAmount: number | null;
    initialCurrency: string;
    onClose: () => void;
    onSaved: () => void;
}

export function TripBudgetSheet({
    visible,
    groupId,
    defaultCurrency,
    initialAmount,
    initialCurrency,
    onClose,
    onSaved,
}: TripBudgetSheetProps) {
    const { t } = useTranslation();
    const [amountText, setAmountText] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setAmountText(initialAmount != null ? String(initialAmount) : '');
        setCurrency(initialCurrency || defaultCurrency);
    }, [visible, initialAmount, initialCurrency, defaultCurrency]);

    const handleSave = async () => {
        setLoading(true);
        const trimmed = amountText.trim();
        const parsed = trimmed.length === 0 ? null : Number.parseFloat(trimmed.replace(',', '.'));
        const amount =
            parsed === null || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed;
        const ok = await setGroupTripBudget(groupId, amount, currency);
        setLoading(false);
        if (ok) {
            void captureProductEvent('trip_budget_configured', {
                group_id: groupId,
                has_budget: amount !== null,
                currency,
            });
            onSaved();
        }
    };

    const handleClear = async () => {
        setLoading(true);
        const ok = await setGroupTripBudget(groupId, null, currency);
        setLoading(false);
        if (ok) {
            void captureProductEvent('trip_budget_configured', {
                group_id: groupId,
                has_budget: false,
                currency,
            });
            onSaved();
        }
    };

    return (
        <BottomSheetShell
            visible={visible}
            onClose={onClose}
            label={t('pro.tripBudget.sheetTitle')}
            onSave={() => void handleSave()}
            saveDisabled={loading}
        >
            <View className="px-4 pb-6 pt-2 gap-1">
                <Text className="text-gray-600 text-sm mb-2">{t('pro.tripBudget.sheetBody')}</Text>
                <Input
                    label={t('expenses.amount')}
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                    placeholder={t('pro.tripBudget.amountPlaceholder')}
                    containerClassName="mb-3"
                    testID="trip-budget-amount"
                />
                <CurrencyPicker
                    value={currency}
                    onChange={setCurrency}
                    label={t('groups.currency')}
                />
                {initialAmount != null ? (
                    <Pressable
                        onPress={() => void handleClear()}
                        disabled={loading}
                        className="py-3 items-center mt-1"
                        testID="trip-budget-clear"
                    >
                        <Text className="text-red-600 font-medium">{t('pro.tripBudget.clear')}</Text>
                    </Pressable>
                ) : null}
            </View>
        </BottomSheetShell>
    );
}
