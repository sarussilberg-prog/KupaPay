/**
 * SummaryBalanceStrip — tappable middle row of GroupSummaryCard.
 *
 * Sentence renders the primary (largest |net|) currency in green (owed) or red
 * (owe). Additional non-zero currencies render as inline chips below the
 * sentence. When more than `INLINE_LIMIT` chips would appear, the extras
 * collapse behind a subtle "Show N more" toggle so the strip stays compact on
 * small screens.
 */

import React, { useState } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';
import { useTranslation, Trans } from 'react-i18next';
import { GroupRollup } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { formatAmountDecimal } from '../../lib/currencyDisplay';
import { colors } from '../../theme';

interface SummaryBalanceStripProps {
    /** Undefined + balanceUnknown=false ⇒ "all settled". */
    rollup?: GroupRollup;
    /** True when the balance dataset is unavailable (offline, no cache). */
    balanceUnknown?: boolean;
    onPress: () => void;
    testID?: string;
}

const INLINE_LIMIT = 2;

function formatAmount(amount: number, currency: string): string {
    return `${currency} ${formatAmountDecimal(Math.abs(amount))}`;
}

function CurrencyChip({
    net,
    currency,
}: {
    net: number;
    currency: string;
}) {
    const owed = net > 0;
    const containerClass = owed
        ? 'rounded-full bg-green-50 px-2.5 py-0.5'
        : 'rounded-full bg-red-50 px-2.5 py-0.5';
    const textClass = owed
        ? 'text-[12px] font-semibold text-green-600'
        : 'text-[12px] font-semibold text-red-500';
    const prefix = owed ? '+' : '−';
    return (
        <View className={containerClass}>
            <Text className={textClass} style={{ fontVariant: ['tabular-nums'] }}>
                {`${prefix}${formatAmount(net, currency)}`}
            </Text>
        </View>
    );
}

export function SummaryBalanceStrip({
    rollup,
    balanceUnknown,
    onPress,
    testID,
}: SummaryBalanceStripProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const hasRealBalance = rollup && Math.abs(rollup.primary.net) >= 0.01;
    // Only "settled" when we actually have the data and it's zero. If the
    // dataset is unavailable, say so rather than claiming the group is settled.
    const isUnknown = !hasRealBalance && Boolean(balanceUnknown);
    const isSettled = !hasRealBalance && !isUnknown;
    const net = rollup?.primary.net ?? 0;
    const currency = rollup?.primary.currency ?? '';
    const others = rollup?.others ?? [];
    const owed = net > 0;
    const amount = formatAmount(net, currency);
    const amountColor = owed ? colors.success.text : colors.error;
    const [expanded, setExpanded] = useState(false);

    const nonZeroOthers = others.filter(o => Math.abs(o.net) >= 0.01);
    const hasOthers = nonZeroOthers.length > 0;
    const overflows = nonZeroOthers.length > INLINE_LIMIT;
    const visibleOthers =
        overflows && !expanded ? nonZeroOthers.slice(0, INLINE_LIMIT) : nonZeroOthers;
    const hiddenCount = overflows && !expanded
        ? nonZeroOthers.length - INLINE_LIMIT
        : 0;

    return (
        <View
            style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
            }}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                testID={testID}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Text
                    className="text-[15px] text-gray-900 flex-1"
                    numberOfLines={2}
                >
                    {isUnknown ? (
                        <Text className="text-[15px] text-gray-400" testID="summary-balance-unknown">
                            {t('groups.card.balanceUnavailable')}
                        </Text>
                    ) : isSettled ? (
                        t('groups.card.settled')
                    ) : (
                        <Trans
                            i18nKey={
                                owed ? 'groups.summary.youAreOwed' : 'groups.summary.youOwe'
                            }
                            values={{ amount }}
                            components={{
                                1: (
                                    <Text
                                        className="font-bold"
                                        style={{
                                            color: amountColor,
                                            fontVariant: ['tabular-nums'],
                                        }}
                                    />
                                ),
                            }}
                        >
                            {owed
                                ? `You have <1>${amount}</1> to your credit`
                                : `You owe <1>${amount}</1>`}
                        </Trans>
                    )}
                </Text>
                <AppIcon
                    name={isRtl ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color={colors.gray400}
                />
            </TouchableOpacity>
            {hasOthers && (
                <View
                    style={{
                        marginTop: 8,
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                    }}
                    testID="summary-balance-others"
                >
                    {visibleOthers.map(o => (
                        <View
                            key={`${o.currency}:${o.net}`}
                            style={{ marginEnd: 6, marginBottom: 6 }}
                        >
                            <CurrencyChip net={o.net} currency={o.currency} />
                        </View>
                    ))}
                    {(hiddenCount > 0 || expanded) && (
                        <Pressable
                            onPress={() => setExpanded(v => !v)}
                            hitSlop={6}
                            style={{ marginBottom: 6 }}
                            testID="summary-balance-others-toggle"
                        >
                            <Text className="text-[12px] font-medium text-gray-500 underline">
                                {expanded
                                    ? t('groups.summary.showLess')
                                    : t('groups.summary.showMore', { count: hiddenCount })}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}
