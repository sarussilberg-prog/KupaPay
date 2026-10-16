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
    formatMoney,
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
        container: 'rounded-2xl bg-gray-100 px-2.5 py-1.5',
        label: 'text-[10px] font-medium text-gray-500',
        amount: 'text-xs font-semibold text-gray-500',
    },
    owe: {
        container: 'rounded-2xl bg-red-50 px-2.5 py-1.5',
        label: 'text-[10px] font-medium text-red-600/90',
        amount: 'text-xs font-semibold text-red-600',
    },
    owed: {
        container: 'rounded-2xl bg-green-50 px-2.5 py-1.5',
        label: 'text-[10px] font-medium text-green-700/90',
        amount: 'text-xs font-semibold text-green-700',
    },
    unknown: {
        container: 'rounded-2xl bg-gray-100 px-2.5 py-1.5',
        label: 'text-[10px] font-medium text-gray-400',
        amount: 'text-xs font-medium text-gray-400',
    },
} as const;

/** Trailing column: align copy toward the card center so RTL/LTR chips stay inside the card. */
function chipColumnAlign(isRtl: boolean): ViewStyle['alignItems'] {
    return isRtl ? 'flex-start' : 'flex-end';
}

function chipTextAlign(isRtl: boolean): 'left' | 'right' {
    return isRtl ? 'left' : 'right';
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
            maxWidth: 136,
            minWidth: 88,
            alignItems: chipColumnAlign(isRtl),
            alignSelf: 'center',
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
                <Text className={toneStyles.unknown.amount} style={{ textAlign, width: '100%' }}>
                    —
                </Text>
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
                <Text
                    className={styles.label}
                    numberOfLines={2}
                    style={{ textAlign, width: '100%' }}
                >
                    {t(captionKey)}
                </Text>
            </View>
        );
    }

    const currency = primary?.currency || defaultCurrency;
    const amountText = formatMoney(primary!.net, currency, {
        language: i18n.language,
        absolute: true,
    });

    const extraLabel =
        extraCount > 0
            ? t('groups.card.moreCurrencies', { count: extraCount })
            : null;

    return (
        <View className={styles.container} style={columnStyle} testID="balance-chip-active">
            <Text
                className={styles.label}
                numberOfLines={2}
                style={{ textAlign, width: '100%' }}
            >
                {t(captionKey)}
            </Text>
            <Text
                className={styles.amount}
                numberOfLines={1}
                testID="balance-chip-amount"
                style={{ textAlign, width: '100%', writingDirection: 'ltr' }}
            >
                {amountText}
            </Text>
            {extraLabel ? (
                onPressExtraCurrencies ? (
                    <TouchableOpacity
                        onPress={onPressExtraCurrencies}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        testID="balance-chip-others"
                    >
                        <Text
                            className={`${styles.label} underline mt-0.5`}
                            numberOfLines={1}
                            style={{ textAlign, width: '100%' }}
                        >
                            {extraLabel}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <Text
                        className={`${styles.label} mt-0.5`}
                        testID="balance-chip-others"
                        numberOfLines={1}
                        style={{ textAlign, width: '100%' }}
                    >
                        {extraLabel}
                    </Text>
                )
            ) : null}
        </View>
    );
}
