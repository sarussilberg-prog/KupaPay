/**
 * BalanceChip — localized net balance for one group (list / cards).
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    GroupRollup,
    balanceChipLabelKey,
    classifyUserNetBalance,
    countNonZeroCurrencyOthers,
    formatGroupsListAmount,
    formatSubtleExtraCurrenciesHint,
    resolveGroupRollupTotalDisplay,
    type RatesFromBase,
} from '@cost-share/shared';
import { Text } from './AppText';

interface BalanceChipProps {
    rollup?: GroupRollup;
    /** Group default currency (fallback when display currency omitted). */
    defaultCurrency: string;
    /** User profile / list display currency for FX totals. */
    displayCurrency?: string;
    ratesFromBase?: RatesFromBase;
    groupHasOpenDebts?: boolean;
    balanceUnknown?: boolean;
    onPressExtraCurrencies?: () => void;
}

const toneStyles = {
    settled: {
        container:
            'rounded-xl bg-gray-100/90 dark:bg-gray-700/50 px-3 py-2 border border-gray-200/60 dark:border-gray-600',
        label: 'text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight',
        amount: 'text-sm font-semibold text-gray-600 dark:text-gray-300 leading-tight',
    },
    owe: {
        container: 'rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2 border border-red-100 dark:border-red-900/60',
        label: 'text-[11px] font-medium text-red-700/90 dark:text-red-300 leading-[14px]',
        amount: 'text-sm font-semibold text-red-600 dark:text-red-400 leading-[18px]',
    },
    owed: {
        container:
            'rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 border border-emerald-100 dark:border-emerald-900/60',
        label: 'text-[11px] font-medium text-emerald-800/90 dark:text-emerald-300 leading-[14px]',
        amount: 'text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-[18px]',
    },
    unknown: {
        container: 'rounded-xl bg-gray-100 dark:bg-gray-700/50 px-3 py-2 border border-gray-200/60 dark:border-gray-600',
        label: 'text-[11px] font-medium text-gray-400 dark:text-gray-500 leading-tight',
        amount: 'text-sm font-medium text-gray-400 dark:text-gray-500 leading-tight',
    },
} as const;

const CHIP_MIN_WIDTH = 104;
const CHIP_MAX_WIDTH = 120;

function ChipText({
    className,
    children,
    numberOfLines = 1,
    testID,
    writingDirection,
}: {
    className: string;
    children: React.ReactNode;
    numberOfLines?: number;
    testID?: string;
    writingDirection?: 'ltr' | 'rtl';
}) {
    return (
        <Text
            className={className}
            numberOfLines={numberOfLines}
            testID={testID}
            style={{ textAlign: 'center', width: '100%', writingDirection }}
        >
            {children}
        </Text>
    );
}

export function BalanceChip({
    rollup,
    defaultCurrency,
    displayCurrency,
    ratesFromBase,
    groupHasOpenDebts,
    balanceUnknown,
    onPressExtraCurrencies,
}: BalanceChipProps) {
    const { t, i18n } = useTranslation();
    const primary = rollup?.primary;
    const userDisplayCurrency = displayCurrency ?? defaultCurrency;
    const totalDisplay = useMemo(
        () => resolveGroupRollupTotalDisplay(rollup, userDisplayCurrency, ratesFromBase),
        [rollup, userDisplayCurrency, ratesFromBase],
    );
    const displayNet = totalDisplay?.net ?? primary?.net;
    const displayCurrencyCode = totalDisplay?.currency ?? userDisplayCurrency;
    const extraCount = countNonZeroCurrencyOthers(rollup?.others, primary?.currency);
    const showExtraCurrenciesLink =
        totalDisplay?.conversionFailed === true && extraCount > 0;
    const hasRealBalance = displayNet !== undefined && Math.abs(displayNet) >= 0.01;

    const columnStyle = useMemo<ViewStyle>(
        () => ({
            flexShrink: 0,
            minWidth: CHIP_MIN_WIDTH,
            maxWidth: CHIP_MAX_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            gap: 2,
        }),
        [],
    );

    if (!hasRealBalance && balanceUnknown) {
        return (
            <View
                className={toneStyles.unknown.container}
                style={columnStyle}
                testID="balance-chip-unknown"
                accessibilityLabel={t('groups.card.balanceUnavailable')}
            >
                <ChipText className={toneStyles.unknown.amount}>—</ChipText>
            </View>
        );
    }

    const tone: keyof typeof toneStyles = hasRealBalance
        ? classifyUserNetBalance(displayNet!)
        : 'settled';
    const styles = toneStyles[tone === 'unknown' ? 'settled' : tone];
    const captionKey = balanceChipLabelKey(tone, groupHasOpenDebts);

    if (tone === 'settled' || tone === 'unknown') {
        return (
            <View className={styles.container} style={columnStyle} testID="balance-chip-settled">
                <ChipText className={styles.label} numberOfLines={2}>
                    {t(captionKey)}
                </ChipText>
            </View>
        );
    }

    const amountText = formatGroupsListAmount(displayNet!, displayCurrencyCode, {
        language: i18n.language,
    });

    const extraLabel = showExtraCurrenciesLink
        ? formatSubtleExtraCurrenciesHint(
              extraCount,
              t('groups.card.moreCurrenciesNoun', { count: extraCount }),
          )
        : null;

    return (
        <View className={styles.container} style={columnStyle} testID="balance-chip-active">
            <ChipText className={styles.label} numberOfLines={2}>
                {t(captionKey)}
            </ChipText>
            <ChipText className={styles.amount} testID="balance-chip-amount">
                {amountText}
            </ChipText>
            {extraLabel ? (
                onPressExtraCurrencies ? (
                    <TouchableOpacity
                        onPress={onPressExtraCurrencies}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        testID="balance-chip-others"
                    >
                        <ChipText
                            className={`${styles.label} opacity-80`}
                            numberOfLines={1}
                        >
                            {extraLabel}
                        </ChipText>
                    </TouchableOpacity>
                ) : (
                    <ChipText
                        className={`${styles.label} opacity-80`}
                        testID="balance-chip-others"
                        numberOfLines={1}
                    >
                        {extraLabel}
                    </ChipText>
                )
            ) : null}
        </View>
    );
}
