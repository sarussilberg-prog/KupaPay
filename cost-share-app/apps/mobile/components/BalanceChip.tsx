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
    wrapLtrForBidi,
} from '@cost-share/shared';
import { Text } from './AppText';
import { useRtlLayout } from '../hooks/useRtlLayout';

interface BalanceChipProps {
    rollup?: GroupRollup;
    defaultCurrency: string;
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
        label: 'text-[11px] font-medium text-red-700/90 dark:text-red-300 leading-tight',
        amount: 'text-sm font-bold text-red-600 dark:text-red-400 leading-tight',
    },
    owed: {
        container:
            'rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 border border-emerald-100 dark:border-emerald-900/60',
        label: 'text-[11px] font-medium text-emerald-800/90 dark:text-emerald-300 leading-tight',
        amount: 'text-sm font-bold text-emerald-700 dark:text-emerald-400 leading-tight',
    },
    unknown: {
        container: 'rounded-xl bg-gray-100 dark:bg-gray-700/50 px-3 py-2 border border-gray-200/60 dark:border-gray-600',
        label: 'text-[11px] font-medium text-gray-400 dark:text-gray-500 leading-tight',
        amount: 'text-sm font-medium text-gray-400 dark:text-gray-500 leading-tight',
    },
} as const;

/** Trailing column: align copy toward the card center so RTL/LTR chips stay inside the card. */
function chipColumnAlign(isRtl: boolean): ViewStyle['alignItems'] {
    return isRtl ? 'flex-start' : 'flex-end';
}

function chipTextAlign(isRtl: boolean): 'left' | 'right' {
    return isRtl ? 'left' : 'right';
}

function ChipText({
    className,
    children,
    textAlign,
    numberOfLines = 1,
    testID,
    writingDirection,
}: {
    className: string;
    children: React.ReactNode;
    textAlign: 'left' | 'right';
    numberOfLines?: number;
    testID?: string;
    writingDirection?: 'ltr' | 'rtl';
}) {
    return (
        <Text
            className={className}
            numberOfLines={numberOfLines}
            testID={testID}
            style={{ textAlign, width: '100%', writingDirection }}
        >
            {children}
        </Text>
    );
}

export function BalanceChip({
    rollup,
    defaultCurrency,
    groupHasOpenDebts,
    balanceUnknown,
    onPressExtraCurrencies,
}: BalanceChipProps) {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const primary = rollup?.primary;
    const extraCount = countNonZeroCurrencyOthers(rollup?.others);
    const hasRealBalance = primary && Math.abs(primary.net) >= 0.01;

    const columnStyle = useMemo<ViewStyle>(
        () => ({
            flexShrink: 0,
            maxWidth: 140,
            minWidth: 88,
            alignItems: chipColumnAlign(isRtl),
            alignSelf: 'center',
            gap: 2,
        }),
        [isRtl],
    );

    const textAlign = chipTextAlign(isRtl);

    if (!hasRealBalance && balanceUnknown) {
        return (
            <View
                className={toneStyles.unknown.container}
                style={columnStyle}
                testID="balance-chip-unknown"
                accessibilityLabel={t('groups.card.balanceUnavailable')}
            >
                <ChipText className={toneStyles.unknown.amount} textAlign={textAlign}>
                    —
                </ChipText>
            </View>
        );
    }

    const tone: keyof typeof toneStyles = hasRealBalance
        ? classifyUserNetBalance(primary!.net)
        : 'settled';
    const styles = toneStyles[tone === 'unknown' ? 'settled' : tone];
    const captionKey = balanceChipLabelKey(tone, groupHasOpenDebts);

    if (tone === 'settled' || tone === 'unknown') {
        return (
            <View className={styles.container} style={columnStyle} testID="balance-chip-settled">
                <ChipText className={styles.label} textAlign={textAlign} numberOfLines={2}>
                    {t(captionKey)}
                </ChipText>
            </View>
        );
    }

    const currency = primary?.currency || defaultCurrency;
    const amountText = formatGroupsListAmount(primary!.net, currency, {
        language: i18n.language,
    });

    const extraLabel =
        extraCount > 0
            ? wrapLtrForBidi(
                  t('groups.card.moreCurrencies', {
                      count: extraCount,
                  }),
              )
            : null;

    return (
        <View className={styles.container} style={columnStyle} testID="balance-chip-active">
            <ChipText className={styles.label} textAlign={textAlign} numberOfLines={2}>
                {t(captionKey)}
            </ChipText>
            <ChipText
                className={styles.amount}
                textAlign={textAlign}
                testID="balance-chip-amount"
                writingDirection="ltr"
            >
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
                        className={`${styles.label} underline mt-0.5`}
                        textAlign={textAlign}
                        numberOfLines={2}
                    >
                        {extraLabel}
                    </ChipText>
                    </TouchableOpacity>
                ) : (
                    <ChipText
                        className={`${styles.label} mt-0.5`}
                        textAlign={textAlign}
                        testID="balance-chip-others"
                    >
                        {extraLabel}
                    </ChipText>
                )
            ) : null}
        </View>
    );
}
