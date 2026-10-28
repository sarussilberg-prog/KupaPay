/**
 * GroupsListSummaryCard — mockup B2 balance card above the groups list.
 */

import React, { useMemo } from 'react';
import { View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    classifyUserNetBalance,
    deriveGroupsListSummaryParts,
    formatGroupsListAmount,
    type BalanceSummary,
} from '@cost-share/shared';
import { Text } from '../AppText';
import { useRtlLayout, rtlTextAlign } from '../../hooks/useRtlLayout';
import { colors, shadows } from '../../theme';
import type { ProfileBalanceConversion } from '../../hooks/useProfileBalanceSummary';
import { GROUPS_LIST_SUMMARY_AMOUNT_MIN_FONT_SCALE } from '../groupsListLayout';

interface GroupsListSummaryCardProps {
    summary: BalanceSummary | undefined;
    conversion?: ProfileBalanceConversion;
    balanceUnknown?: boolean;
}

const toneAmountClass: Record<string, string> = {
    settled: 'text-2xl font-semibold text-slate-500 dark:text-slate-400 tabular-nums text-center',
    owe: 'text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums text-center',
    owed: 'text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-center',
    unknown: 'text-3xl font-semibold text-slate-400 dark:text-slate-500 tabular-nums text-center',
    loading: 'text-3xl font-semibold text-slate-400 dark:text-slate-500 tabular-nums text-center',
};

export function GroupsListSummaryCard({
    summary,
    conversion,
    balanceUnknown,
}: GroupsListSummaryCardProps) {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const { width: windowWidth } = useWindowDimensions();
    const align = rtlTextAlign(isRtl);
    const direction: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';
    const summaryAmountFit = windowWidth < 400;

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
            : formatGroupsListAmount(net, parts.primaryCurrency, {
                  language: i18n.language,
              });

    const showFxFailureHint =
        !isLoading &&
        conversion?.failed === true &&
        !conversion?.isConverted &&
        parts.foreignCurrencyCount > 0;

    const foreignHintLine = showFxFailureHint
        ? t('groups.listSummary.otherCurrenciesHint', {
              count: parts.foreignCurrencyCount,
          })
        : null;

    return (
        <View
            testID="groups-list-summary-card"
            className="mx-0 mb-4 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 px-4 py-4"
            style={shadows.sm}
        >
            <Text
                className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2"
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
                    style={{ textAlign: align, writingDirection: direction, minWidth: 0 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit={summaryAmountFit}
                    minimumFontScale={
                        summaryAmountFit ? GROUPS_LIST_SUMMARY_AMOUNT_MIN_FONT_SCALE : undefined
                    }
                >
                    {amountText}
                </Text>
            )}
            {foreignHintLine ? (
                <Text
                    testID="groups-list-summary-foreign-hint"
                    className="text-[11px] text-slate-400 dark:text-slate-500 mt-2"
                    style={{ textAlign: align, writingDirection: direction, minWidth: 0 }}
                    numberOfLines={2}
                >
                    {foreignHintLine}
                </Text>
            ) : null}
        </View>
    );
}
