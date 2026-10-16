import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
import { CurrencyPicker } from '../CurrencyPicker';
import { setGroupTripBudget } from '../../services/tripBudget.service';
import { captureProductEvent } from '../../lib/productAnalytics';
import { rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';

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
    const isRtl = useRtlLayout();
    const [amountText, setAmountText] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency);
    const [pickerOpen, setPickerOpen] = useState(false);
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
        <>
            <BottomSheetShell
                visible={visible}
                onClose={onClose}
                label={t('pro.tripBudget.sheetTitle')}
            >
                <Text className="text-gray-600 text-sm mb-3">{t('pro.tripBudget.sheetBody')}</Text>
                <TextInput
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                    placeholder={t('pro.tripBudget.amountPlaceholder')}
                    className={[
                        'border border-gray-200 rounded-xl px-3 py-3 mb-3 text-gray-900',
                        rtlTextClassName(isRtl),
                    ]
                        .filter(Boolean)
                        .join(' ')}
                />
                <Pressable
                    onPress={() => setPickerOpen(true)}
                    className="border border-gray-200 rounded-xl py-3 px-3 mb-4"
                >
                    <Text className="text-gray-700 text-center">{currency}</Text>
                </Pressable>
                <Pressable
                    onPress={() => void handleSave()}
                    disabled={loading}
                    className="bg-primary rounded-xl py-3 items-center mb-2"
                >
                    <Text className="text-white font-semibold">{t('common.save')}</Text>
                </Pressable>
                {initialAmount != null && (
                    <Pressable onPress={() => void handleClear()} disabled={loading} className="py-3 items-center">
                        <Text className="text-red-600 font-medium">{t('pro.tripBudget.clear')}</Text>
                    </Pressable>
                )}
            </BottomSheetShell>
            <CurrencyPicker
                visible={pickerOpen}
                value={currency}
                onChange={c => {
                    setCurrency(c);
                    setPickerOpen(false);
                }}
                onClose={() => setPickerOpen(false)}
            />
        </>
    );
}
