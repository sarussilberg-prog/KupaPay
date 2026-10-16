/**
 * GroupsListSummaryCard — mockup B2 balance card above the groups list.
 */

import React, { useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    classifyUserNetBalance,
    deriveGroupsListSummaryParts,
    formatMoney,
    wrapLtrForBidi,
    type BalanceSummary,
} from '@cost-share/shared';
import { Text } from '../AppText';
import { useRtlLayout, rtlTextAlign } from '../../hooks/useRtlLayout';
import { colors, shadows } from '../../theme';
import type { ProfileBalanceConversion } from '../../hooks/useProfileBalanceSummary';

interface GroupsListSummaryCardProps {
    summary: BalanceSummary | undefined;
    conversion?: ProfileBalanceConversion;
    balanceUnknown?: boolean;
}

const toneAmountClass: Record<string, string> = {
    settled: 'text-2xl font-semibold text-slate-500 tabular-nums text-center',
    owe: 'text-3xl font-bold text-red-600 tabular-nums text-center',
    owed: 'text-3xl font-bold text-emerald-600 tabular-nums text-center',
    unknown: 'text-3xl font-semibold text-slate-400 tabular-nums text-center',
    loading: 'text-3xl font-semibold text-slate-400 tabular-nums text-center',
};

export function GroupsListSummaryCard({
    summary,
    conversion,
    balanceUnknown,
}: GroupsListSummaryCardProps) {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const align = rtlTextAlign(isRtl);
    const direction: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';

    const parts = useMemo(
        () => deriveGroupsListSummaryParts(summary),
        [summary],
    );

    if (!parts || balanceUnknown) return null;

    const isLoading = conversion?.isLoading ?? false;
    const net = parts.primaryNet;
    const tone =
        isLoading ? 'loading' : net === null ? 'unknown' : classifyUserNetBalance(net);

    const labelKey =
        tone === 'owed'
            ? 'dashboard.netOwedToYou'
            : tone === 'owe'
              ? 'dashboard.netYouOwe'
              : 'dashboard.netBalance';

    const amountText =
        isLoading || net === null
            ? '—'
            : formatMoney(net, parts.primaryCurrency, {
                  language: i18n.language,
                  absolute: true,
              });

    const foreignLine =
        parts.foreignHint && !isLoading
            ? t('groups.listSummary.otherCurrenciesLine', {
                  count: parts.foreignHint.count,
                  countLabel: t('groups.card.moreCurrencies', {
                      count: parts.foreignHint.count,
                      plusCount: wrapLtrForBidi(`+${parts.foreignHint.count}`),
                  }),
                  amount: formatMoney(parts.foreignHint.net, parts.foreignHint.currency, {
                      language: i18n.language,
                      absolute: true,
                  }),
              })
            : null;

    return (
        <View
            testID="groups-list-summary-card"
            className="mx-0 mb-4 rounded-2xl bg-white border border-slate-200/80 px-4 py-4"
            style={shadows.sm}
        >
            <Text
                className="text-xs font-medium text-slate-500 mb-2"
                style={{ textAlign: align, writingDirection: direction }}
            >
                {t(labelKey)}
            </Text>
            {isLoading ? (
                <ActivityIndicator size="small" color={colors.gray400} />
            ) : (
                <Text
                    testID="groups-list-summary-amount"
                    className={toneAmountClass[tone] ?? toneAmountClass.unknown}
                    style={{ writingDirection: 'ltr' }}
                >
                    {amountText}
                </Text>
            )}
            {foreignLine ? (
                <Text
                    testID="groups-list-summary-foreign"
                    className="text-sm text-slate-500 mt-2"
                    style={{ textAlign: align, writingDirection: direction }}
                >
                    {foreignLine}
                </Text>
            ) : null}
        </View>
    );
}
