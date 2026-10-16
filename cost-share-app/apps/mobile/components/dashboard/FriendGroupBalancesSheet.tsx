/**
 * FriendGroupBalancesSheet
 * Modal popup that breaks a friend's balance down by group.
 * Each row tap navigates to that group and closes the sheet.
 *
 * Reads from the canonical simplifier output (useSimplifiedDebts) — the same
 * source the group screen uses — so the per-group rows align with the
 * settle-up plan. Cycle phantoms (where Ari→Bar pair-net is non-zero but the
 * 3-way cycle cancels at user level) no longer appear because simplification
 * removes them upstream.
 */

import React, { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    View,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
    computeFriendCrossGroupNet,
    FriendBalanceSummary,
} from '@cost-share/shared';
import { Text } from '../AppText';
import { MemberAvatar } from '../MemberAvatar';
import { GroupAvatar } from '../GroupAvatar';
import { AppIcon } from '../AppIcon';
import { Button } from '../Button';
import { colors } from '../../theme';
import { formatCurrencyAmount } from '../../lib/currencyDisplay';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { queryKeys } from '../../hooks/queries/keys';
import { fetchGroups } from '../../services/groups.service';
import { useSimplifiedDebts } from '../../hooks/useSimplifiedDebts';
import { useExchangeRatesQuery } from '../../hooks/queries/useExchangeRatesQuery';
import { getAvatarUrlForFriend, getDisplayNameForFriend } from '../../lib/userDisplay';
import { FriendCrossGroupSettleSheet } from './FriendCrossGroupSettleSheet';

interface Props {
    visible: boolean;
    friend: FriendBalanceSummary | null;
    currentUserId: string | null;
    defaultCurrency: string;
    onClose: () => void;
    onSelectGroup: (groupId: string) => void;
}

interface CurrencyLine {
    currency: string;
    /** Positive = friend owes the current user. Negative = current user owes the friend. */
    netAmount: number;
}

interface GroupBreakdown {
    groupId: string;
    lines: CurrencyLine[];
    isSettled: boolean;
}

export function FriendGroupBalancesSheet({
    visible,
    friend,
    currentUserId,
    defaultCurrency,
    onClose,
    onSelectGroup,
}: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const { data: simplified } = useSimplifiedDebts();
    const sharedGroupIds = useMemo(() => friend?.sharedGroupIds ?? [], [friend]);
    const [crossSettleOpen, setCrossSettleOpen] = useState(false);
    const [crossSettleQuick, setCrossSettleQuick] = useState(false);

    const groupsQuery = useQuery({
        queryKey: queryKeys.groups,
        queryFn: fetchGroups,
        enabled: visible && sharedGroupIds.length > 0,
    });
    const groups = groupsQuery.data ?? [];

    const groupsById = useMemo(() => {
        const map = new Map<string, { name: string; imageUrl?: string; groupType: string }>();
        groups.forEach(g => map.set(g.id, {
            name: g.name,
            imageUrl: g.imageUrl,
            groupType: g.groupType,
        }));
        return map;
    }, [groups]);
    const friendId = friend?.userId ?? null;

    const breakdowns: GroupBreakdown[] = useMemo(() => {
        if (!friendId || !currentUserId || !simplified) return [];
        return sharedGroupIds.map(groupId => {
            const perCurrency = simplified.byGroupCurrency.get(groupId);
            const lines: CurrencyLine[] = [];
            perCurrency?.forEach((transfers, currency) => {
                let net = 0;
                transfers.forEach(tx => {
                    if (
                        tx.fromUserId === currentUserId &&
                        tx.toUserId === friendId
                    ) {
                        net -= tx.amount;
                    } else if (
                        tx.fromUserId === friendId &&
                        tx.toUserId === currentUserId
                    ) {
                        net += tx.amount;
                    }
                });
                if (Math.abs(net) >= 0.01) {
                    lines.push({ currency, netAmount: net });
                }
            });
            return { groupId, lines, isSettled: lines.length === 0 };
        });
    }, [sharedGroupIds, simplified, friendId, currentUserId]);

    const fxSymbols = useMemo(() => {
        const set = new Set<string>();
        for (const b of breakdowns) {
            for (const line of b.lines) {
                if (line.currency !== defaultCurrency) set.add(line.currency);
            }
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [breakdowns, defaultCurrency]);

    const ratesQuery = useExchangeRatesQuery(defaultCurrency, fxSymbols);
    const ratesFromBase = ratesQuery.data?.rates;

    const crossGroupNet = useMemo(() => {
        if (!simplified || !friendId || !currentUserId) return null;
        return computeFriendCrossGroupNet(
            simplified,
            currentUserId,
            friendId,
            defaultCurrency,
            ratesFromBase,
        );
    }, [simplified, friendId, currentUserId, defaultCurrency, ratesFromBase]);

    const hasOpenBalance =
        crossGroupNet != null && crossGroupNet.perCurrency.length > 0;

    const weightedDisplay = crossGroupNet?.weightedInDefault;
    const weightedPositive = (weightedDisplay?.netBalance ?? 0) > 0.01;
    const weightedNegative = (weightedDisplay?.netBalance ?? 0) < -0.01;
    const weightedAmountClass = weightedPositive
        ? 'text-emerald-600'
        : weightedNegative
          ? 'text-red-600'
          : 'text-gray-900';

    const friendDisplayName = friend ? getDisplayNameForFriend(friend, t) : '';

    const openCrossSettle = (quick: boolean) => {
        setCrossSettleQuick(quick);
        setCrossSettleOpen(true);
    };

    return (
        <>
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-center px-4">
                    <Pressable onPress={() => { }} className="bg-white rounded-2xl max-h-[70%]">
                        {/* Header */}
                        <View
                            style={rtlRowStyle(isRtl)}
                            className="px-4 pt-4 pb-3 items-center border-b border-slate-100"
                        >
                            {friend && (
                                <MemberAvatar
                                    name={friendDisplayName}
                                    avatarUrl={getAvatarUrlForFriend(friend)}
                                    size="md"
                                />
                            )}
                            <View style={{ flex: 1, marginHorizontal: 12, minWidth: 0 }}>
                                <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                                    {friendDisplayName}
                                </Text>
                                <Text className="text-xs text-slate-500 mt-0.5">
                                    {t('dashboard.friendBreakdownTitle')}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel={t('common.cancel')}
                                testID="friend-balances-close"
                            >
                                <AppIcon name="close" size={22} color={colors.gray500} />
                            </TouchableOpacity>
                        </View>

                        {hasOpenBalance && weightedDisplay ? (
                            <View
                                className="px-4 py-3 border-b border-slate-100 bg-slate-50/80"
                                testID="friend-balances-weighted-net"
                            >
                                <Text className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                                    {weightedDisplay.isConverted
                                        ? t('dashboard.convertedLabel')
                                        : t('dashboard.friendCrossNetLabel')}
                                </Text>
                                <Text className={`text-xl font-bold mt-1 ${weightedAmountClass}`}>
                                    {formatCurrencyAmount(
                                        Math.abs(weightedDisplay.netBalance),
                                        weightedDisplay.currency,
                                    )}
                                </Text>
                                {weightedDisplay.conversionFailed ? (
                                    <Text className="text-xs text-amber-700 mt-1">
                                        {t('dashboard.conversionFailed')}
                                    </Text>
                                ) : (
                                    <View className="mt-2 gap-0.5">
                                        {crossGroupNet?.perCurrency.map(line => (
                                            <View
                                                key={line.currency}
                                                style={rtlRowStyle(isRtl)}
                                                className="justify-between"
                                            >
                                                <Text className="text-xs text-slate-500">
                                                    {line.currency}
                                                </Text>
                                                <Text className="text-xs font-medium text-slate-700">
                                                    {formatCurrencyAmount(
                                                        Math.abs(line.netAmount),
                                                        line.currency,
                                                    )}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {hasOpenBalance && !weightedDisplay.conversionFailed ? (
                                    <TouchableOpacity
                                        onPress={() => openCrossSettle(false)}
                                        className="mt-3 py-2"
                                        testID="friend-settle-one-currency"
                                    >
                                        <Text className="text-sm font-semibold text-primary text-center">
                                            {t('dashboard.friendSettleOneCurrency')}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : null}

                        {/* Body */}
                        {breakdowns.length === 0 ? (
                            <View className="py-10 px-6 items-center">
                                <Text className="text-sm text-slate-500 text-center">
                                    {t('dashboard.friendBreakdownEmpty')}
                                </Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={{ paddingVertical: 4 }}>
                                {breakdowns.map((b, idx) => {
                                    const group = groupsById.get(b.groupId);
                                    const isLast = idx === breakdowns.length - 1;
                                    return (
                                        <TouchableOpacity
                                            key={b.groupId}
                                            onPress={() => onSelectGroup(b.groupId)}
                                            style={rtlRowStyle(isRtl)}
                                            className={`items-center px-4 py-3 ${isLast ? '' : 'border-b border-slate-100'}`}
                                            accessibilityRole="button"
                                            testID={`friend-balance-group-${b.groupId}`}
                                        >
                                            <GroupAvatar
                                                imageUrl={group?.imageUrl}
                                                groupType={(group?.groupType as any) ?? 'general'}
                                                size="sm"
                                            />
                                            <View style={{ flex: 1, marginHorizontal: 12, minWidth: 0 }}>
                                                <Text
                                                    className="text-sm font-medium text-gray-900"
                                                    numberOfLines={1}
                                                >
                                                    {group?.name
                                                        ?? (groupsQuery.isLoading ? '…' : t('common.unknown'))}
                                                </Text>
                                                {b.isSettled ? (
                                                    <Text className="text-xs text-slate-400 mt-0.5">
                                                        {t('dashboard.settled')}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <View style={{ alignItems: isRtl ? 'flex-start' : 'flex-end', flexShrink: 0 }}>
                                                {b.lines.map(line => {
                                                    const owesYou = line.netAmount > 0;
                                                    const amountClass = owesYou
                                                        ? 'text-emerald-600'
                                                        : 'text-red-600';
                                                    return (
                                                        <Text
                                                            key={line.currency}
                                                            className={`text-sm font-semibold ${amountClass}`}
                                                        >
                                                            {formatCurrencyAmount(
                                                                Math.abs(line.netAmount),
                                                                line.currency,
                                                            )}
                                                        </Text>
                                                    );
                                                })}
                                            </View>
                                            <AppIcon
                                                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                                                size={16}
                                                color={colors.gray400}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}

                        {hasOpenBalance && !weightedDisplay?.conversionFailed ? (
                            <View className="px-4 py-3 border-t border-slate-100">
                                <Button
                                    title={t('dashboard.friendSettleAll', { name: friendDisplayName })}
                                    onPress={() => openCrossSettle(true)}
                                    testID="friend-settle-all"
                                />
                            </View>
                        ) : null}
                    </Pressable>
                </Pressable>
            </Modal>

            <FriendCrossGroupSettleSheet
                visible={crossSettleOpen}
                friend={friend}
                currentUserId={currentUserId}
                defaultCurrency={defaultCurrency}
                quickSettle={crossSettleQuick}
                onClose={() => setCrossSettleOpen(false)}
                onCompleted={onClose}
            />
        </>
    );
}
