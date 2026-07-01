/**
 * DebtPairGroup — a collapsible summary row for the 2+ open debts between the
 * same two people on the Settle Up screen. Tapping the header toggles expansion
 * to reveal the individual `DebtRow`s, which the caller supplies via
 * `renderDebt` so the existing per-row settle tap is reused unchanged.
 *
 * Connection-level actions (e.g. Send Reminder) live in an action bar at the
 * bottom of the card — once per pair, not per debt. The arrow is
 * one-directional when every debt flows the same way and a swap icon when the
 * pair owes both ways. `involved` controls the highlight vs. dimmed-dashed
 * styling, mirroring `DebtRow`.
 */

import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { MemberAvatar } from '../MemberAvatar';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';
import type { DebtRowDebt } from './DebtRow';
import type { PairGroup } from '../../lib/groupDebtsByPair';

interface DebtPairGroupProps {
    group: PairGroup<DebtRowDebt>;
    involved: boolean;
    currentUserId: string;
    nameFor: (userId: string) => string;
    avatarFor: (userId: string) => string | undefined;
    renderDebt: (debt: DebtRowDebt, index: number) => React.ReactNode;
    /**
     * Reminder is per connection, not per debt — its message already covers
     * every currency owed in that direction. Rendered once on the group row;
     * undefined hides it (e.g. the current user is the only debtor).
     */
    onRemind?: () => void;
    onConvert?: () => void;
}

export function DebtPairGroup({
    group,
    involved,
    currentUserId,
    nameFor,
    avatarFor,
    renderDebt,
    onRemind,
    onConvert,
}: DebtPairGroupProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const [expanded, setExpanded] = useState(false);

    // Avatar order + arrow. One-directional groups read debtor → creditor.
    // Mixed (bidirectional) groups put the current user first when involved —
    // otherwise the pair's first user — and use a two-way arrow.
    let firstUser: string;
    let secondUser: string;
    if (!group.bidirectional) {
        firstUser = group.fromUserId;
        secondUser = group.toUserId;
    } else if (group.userA === currentUserId || group.userB === currentUserId) {
        firstUser = currentUserId;
        secondUser = group.userA === currentUserId ? group.userB : group.userA;
    } else {
        firstUser = group.userA;
        secondUser = group.userB;
    }

    // Perspective-specific label when the current user is a party — "Debts
    // between you and X" — so Hebrew reads "בינך לבין" rather than an
    // ungrammatical injection of the "you" label into the neutral template.
    const currentUserInPair =
        group.userA === currentUserId || group.userB === currentUserId;
    const otherUser = group.userA === currentUserId ? group.userB : group.userA;
    const label = currentUserInPair
        ? t('settleUp.pairGroupLabelSelf', { name: nameFor(otherUser) })
        : t('settleUp.pairGroupLabel', {
              a: nameFor(firstUser),
              b: nameFor(secondUser),
          });

    return (
        <View className="mb-2">
            <View
                className={`rounded-2xl border overflow-hidden ${
                    involved
                        ? 'bg-white border-gray-100'
                        : 'bg-slate-50 border-dashed border-gray-300'
                }`}
            >
                <TouchableOpacity
                    onPress={() => setExpanded(v => !v)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    className="p-4 flex-row items-center"
                    testID={`settle-debt-group-${group.pairKey}`}
                >
                    <MemberAvatar
                        name={nameFor(firstUser)}
                        avatarUrl={avatarFor(firstUser)}
                        size="sm"
                    />
                    <View className="mx-2">
                        {group.bidirectional ? (
                            <AppIcon
                                name="swap-horizontal"
                                size={16}
                                color={colors.gray400}
                                testID="pair-arrow-bidirectional"
                            />
                        ) : (
                            <Text className="text-gray-400">{isRtl ? '←' : '→'}</Text>
                        )}
                    </View>
                    <MemberAvatar
                        name={nameFor(secondUser)}
                        avatarUrl={avatarFor(secondUser)}
                        size="sm"
                    />

                    <View className="flex-1 ml-3">
                        <Text
                            className={`text-sm font-semibold ${
                                involved ? 'text-gray-900' : 'text-gray-600'
                            }`}
                            numberOfLines={1}
                        >
                            {label}
                        </Text>
                        <Text className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
                            {t('settleUp.pairGroupCount', { count: group.debts.length })}
                        </Text>
                    </View>

                    <View className="pl-2 pr-1">
                        <AppIcon
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.gray500}
                        />
                    </View>
                </TouchableOpacity>

                {(onRemind || onConvert) && (
                    <View className="flex-row justify-end px-4 pb-3 -mt-2 gap-4">
                        {onConvert && (
                            <TouchableOpacity
                                onPress={onConvert}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                testID={`convert-group-${group.pairKey}`}
                            >
                                <Text className="text-xs font-medium text-primary">
                                    {t('consolidation.convertButton')}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {onRemind && (
                            <TouchableOpacity
                                onPress={onRemind}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                testID={`remind-group-${group.pairKey}`}
                            >
                                <Text className="text-xs font-medium text-primary">
                                    {t('remind.sendReminderButton')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {expanded && (
                    <View
                        className="px-2 pt-2 border-t border-gray-200"
                        testID={`settle-debt-group-children-${group.pairKey}`}
                    >
                        {group.debts.map((debt, index) => renderDebt(debt, index))}
                    </View>
                )}
            </View>
        </View>
    );
}
