/**
 * Pro perk: view all group pairwise debts converted into one trip currency.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ProUpgradeButton } from '../ProUpgradeButton';
import { useTranslation } from 'react-i18next';
import type { PairwiseDebt } from '@cost-share/shared';
import { Text } from '../AppText';
import { CurrencyPicker } from '../CurrencyPicker';
import { useExchangeRatesQuery } from '../../hooks/queries/useExchangeRatesQuery';
import { convertDebtsToTripCurrency } from '../../lib/tripCurrencyConversion';
import { captureProductEvent } from '../../lib/productAnalytics';

interface GroupTripCurrencySectionProps {
    defaultCurrency: string;
    debts: PairwiseDebt[];
    memberNames: Record<string, string>;
    enabled: boolean;
    onUpgrade: () => void;
}

export function GroupTripCurrencySection({
    defaultCurrency,
    debts,
    memberNames,
    enabled,
    onUpgrade,
}: GroupTripCurrencySectionProps) {
    const { t } = useTranslation();
    const [targetCurrency, setTargetCurrency] = useState(defaultCurrency);
    const [pickerOpen, setPickerOpen] = useState(false);

    const currencies = useMemo(
        () => [...new Set(debts.map(d => d.currency))],
        [debts],
    );

    const fxSymbols = useMemo(() => {
        const s = new Set(currencies);
        if (targetCurrency) s.add(targetCurrency);
        return [...s];
    }, [currencies, targetCurrency]);

    const { data: rates } = useExchangeRatesQuery(targetCurrency, fxSymbols);
    const converted = useMemo(
        () => convertDebtsToTripCurrency(debts, targetCurrency, rates?.rates ?? null),
        [debts, targetCurrency, rates?.rates],
    );

    useEffect(() => {
        if (!enabled || currencies.length <= 1) return;
        void captureProductEvent('trip_currency_viewed', {
            target_currency: targetCurrency,
            debt_currencies: currencies.length,
        });
    }, [enabled, currencies.length, targetCurrency]);

    if (!enabled) {
        return (
            <View className="mx-4 mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <Text className="text-gray-800 font-semibold mb-1">{t('pro.tripCurrency.title')}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t('pro.tripCurrency.lockedBody')}</Text>
                <ProUpgradeButton
                    title={t('pro.tripCurrency.upgrade')}
                    onPress={onUpgrade}
                    testID="trip-currency-upgrade"
                />
            </View>
        );
    }

    if (currencies.length <= 1) return null;

    return (
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-white border border-gray-100">
            <Text className="text-gray-900 font-semibold mb-2">{t('pro.tripCurrency.title')}</Text>
            <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                className="border border-gray-200 rounded-xl py-3 px-3 mb-3"
            >
                <Text className="text-gray-700 text-center">
                    {t('pro.tripCurrency.pickerLabel', { currency: targetCurrency })}
                </Text>
            </TouchableOpacity>
            {rates?.date ? (
                <Text className="text-gray-400 text-xs mb-2 text-center">
                    {t('pro.tripCurrency.ratesAsOf', { date: rates.date })}
                </Text>
            ) : null}
            {converted.length === 0 ? (
                <Text className="text-gray-500 text-sm">{t('pro.tripCurrency.ratesMissing')}</Text>
            ) : (
                converted.slice(0, 8).map(row => (
                    <Text key={`${row.fromUserId}-${row.toUserId}-${row.originalCurrency}`} className="text-sm text-gray-700 mb-1">
                        {t('pro.tripCurrency.row', {
                            from: memberNames[row.fromUserId] ?? '—',
                            to: memberNames[row.toUserId] ?? '—',
                            amount: row.convertedAmount,
                            currency: targetCurrency,
                            original: `${row.originalAmount} ${row.originalCurrency}`,
                        })}
                    </Text>
                ))
            )}
            <CurrencyPicker
                value={targetCurrency}
                onChange={setTargetCurrency}
                visible={pickerOpen}
                onClose={() => setPickerOpen(false)}
            />
        </View>
    );
}
