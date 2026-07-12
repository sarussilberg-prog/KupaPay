/**
 * BalanceChip — small pill summarising a single group's net balance for the user.
 * Variants by sign: positive = owed (green), negative = owe (red), zero/undefined = settled (gray).
 *
 * Consumes a `GroupRollup` from the canonical simplifier output. The primary
 * entry (largest |net|) is rendered as the chip; when `others` is non-empty we
 * append a small "+N" suffix so the row signals more currencies exist without
 * growing taller.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupRollup } from '@cost-share/shared';

interface BalanceChipProps {
    rollup?: GroupRollup;
    /** Currency to use in the "settled" / no-data state. Usually the group's default currency. */
    defaultCurrency: string;
    /**
     * True when the group has at least one open debt among other members (not
     * involving the current user). Lets the settled chip distinguish
     * "You are settled" (others still owe) from "Settled" (whole group clear).
     */
    groupHasOpenDebts?: boolean;
    /**
     * True when the balance dataset itself is unavailable (e.g. offline with no
     * cached balances). We then show a neutral placeholder instead of claiming
     * "Settled" — never report a balance we don't actually have.
     */
    balanceUnknown?: boolean;
}

function formatAmount(amount: number, currency: string): string {
    return `${currency} ${Math.abs(amount).toFixed(2)}`;
}

export function BalanceChip({
    rollup,
    defaultCurrency,
    groupHasOpenDebts,
    balanceUnknown,
}: BalanceChipProps) {
    const { t } = useTranslation();
    const primary = rollup?.primary;
    const extraCount = (rollup?.others ?? []).filter(
        o => Math.abs(o.net) >= 0.01,
    ).length;
    const hasRealBalance = primary && Math.abs(primary.net) >= 0.01;

    // No real balance to show AND the dataset is unavailable → neutral
    // placeholder. We don't have the data, so we don't claim "settled".
    if (!hasRealBalance && balanceUnknown) {
        return (
            <View
                className="rounded-full bg-gray-100 px-2.5 py-1"
                testID="balance-chip-unknown"
                accessibilityLabel={t('groups.card.balanceUnavailable')}
            >
                <Text className="text-xs font-medium text-gray-400">—</Text>
            </View>
        );
    }

    if (!primary || Math.abs(primary.net) < 0.01) {
        const label = groupHasOpenDebts
            ? t('groups.card.youSettled')
            : t('groups.card.settled');
        return (
            <View className="rounded-full bg-gray-100 px-2.5 py-1 max-w-[140px]">
                <Text
                    className="text-xs font-medium text-gray-500"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {label}
                </Text>
            </View>
        );
    }

    const isOwed = primary.net > 0;
    const containerClass = isOwed
        ? 'rounded-full bg-green-50 px-2.5 py-1 max-w-[140px] flex-row items-center'
        : 'rounded-full bg-red-50 px-2.5 py-1 max-w-[140px] flex-row items-center';
    const textClass = isOwed
        ? 'text-xs font-semibold text-green-600'
        : 'text-xs font-semibold text-red-500';
    const prefix = isOwed ? '+' : '−';

    return (
        <View className={containerClass}>
            <Text className={textClass} numberOfLines={1} ellipsizeMode="tail">
                {`${prefix}${formatAmount(primary.net, primary.currency || defaultCurrency)}`}
            </Text>
            {extraCount > 0 && (
                <Text
                    className={`ml-1 text-[10px] font-semibold ${
                        isOwed ? 'text-green-600/70' : 'text-red-500/70'
                    }`}
                    testID="balance-chip-others"
                >
                    {`+${extraCount}`}
                </Text>
            )}
        </View>
    );
}
