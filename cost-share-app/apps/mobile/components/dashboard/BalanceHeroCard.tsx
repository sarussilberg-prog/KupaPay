import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BalanceSummary } from '@cost-share/shared';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

interface Props { summary: BalanceSummary; }

function formatMoney(value: number | null, currency: string): string {
    if (value === null || !Number.isFinite(value)) return '—';
    return `${value.toFixed(2)} ${currency}`;
}

export function BalanceHeroCard({ summary }: Props) {
    const { t } = useTranslation();
    const multi = summary.totalOwed === null || summary.totalOwedToUser === null;
    const [expanded, setExpanded] = useState(multi);

    return (
        <View className="rounded-2xl mx-4 mb-4 p-5 border border-blue-100" style={{ backgroundColor: '#DBEAFE' }}>
            <View className="flex-row gap-3">
                <View className="flex-1 bg-white/60 rounded-xl p-3">
                    <Text className="text-xs text-gray-600">{t('dashboard.youOwe')}</Text>
                    <Text className="text-2xl font-bold text-red-600 mt-1">
                        {formatMoney(summary.totalOwed, summary.defaultCurrency)}
                    </Text>
                </View>
                <View className="flex-1 bg-white/60 rounded-xl p-3">
                    <Text className="text-xs text-gray-600">{t('dashboard.youAreOwed')}</Text>
                    <Text className="text-2xl font-bold text-green-600 mt-1">
                        {formatMoney(summary.totalOwedToUser, summary.defaultCurrency)}
                    </Text>
                </View>
            </View>

            {summary.byCurrency.length > 0 ? (
                <TouchableOpacity
                    onPress={() => setExpanded(v => !v)}
                    testID="balance-hero-toggle"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    className="mt-3 flex-row items-center self-start"
                >
                    <Text className="text-sm text-primary me-1">
                        {expanded ? t('dashboard.hideBreakdown') : t('dashboard.viewBreakdown')}
                    </Text>
                    <AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                </TouchableOpacity>
            ) : null}

            {expanded ? (
                <View className="mt-3 bg-white/60 rounded-xl p-3">
                    {summary.byCurrency.map(row => (
                        <View key={row.currency} className="flex-row justify-between py-1">
                            <Text className="text-sm font-medium text-gray-700">{row.currency}</Text>
                            <Text className="text-sm text-gray-600">
                                -{row.owed.toFixed(2)} / +{row.owedToUser.toFixed(2)}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}
