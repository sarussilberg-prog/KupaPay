/**
 * DebtRow — one row in any debt list (Settle Up screen, simplified
 * debts on Balances screen). Tapping the row body triggers `onPress`, which
 * the caller wires to opening SettleUpSheet pre-filled.
 *
 * `involved` controls highlight vs. dimmed-dashed styling — `true` for
 * debts where the current user is the payer or receiver. When `onRemind` is
 * provided, a Send Reminder action button is stuck to the bottom of the row,
 * matching the action bar in `DebtPairGroup`.
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { MemberAvatar } from '../MemberAvatar';
import { useRtlLayout } from '../../hooks/useRtlLayout';

export interface DebtRowDebt {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
}

interface DebtRowProps {
    debt: DebtRowDebt;
    involved: boolean;
    fromName: string;
    toName: string;
    currentUserId: string;
    fromAvatar?: string;
    toAvatar?: string;
    onPress: () => void;
    onRemind?: () => void;
    onConvert?: () => void;
}

export function DebtRow({
    debt,
    involved,
    fromName,
    toName,
    currentUserId,
    fromAvatar,
    toAvatar,
    onPress,
    onRemind,
    onConvert,
}: DebtRowProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const amountText = `${debt.currency} ${debt.amount.toFixed(2)}`;
    // Use second-person, perspective-specific copy when the current user is a
    // party — otherwise injecting the "you" label into the generic template
    // yields ungrammatical Hebrew (e.g. "חייב לאת/ה" instead of "חייב לך").
    const rowLabel =
        debt.fromUserId === currentUserId
            ? t('settleUp.rowYouOwe', { to: toName, amount: amountText })
            : debt.toUserId === currentUserId
              ? t('settleUp.rowOwesYou', { from: fromName, amount: amountText })
              : t('settleUp.row', { from: fromName, to: toName, amount: amountText });
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
                    onPress={onPress}
                    activeOpacity={0.7}
                    className="p-4 flex-row items-center"
                    accessibilityRole="button"
                    testID={`settle-debt-${debt.fromUserId}-${debt.toUserId}-${debt.currency}`}
                >
                    <MemberAvatar name={fromName} avatarUrl={fromAvatar} size="sm" />
                    <View className="mx-2">
                        <Text className="text-gray-400">{isRtl ? '←' : '→'}</Text>
                    </View>
                    <MemberAvatar name={toName} avatarUrl={toAvatar} size="sm" />

                    <View className="flex-1 ml-3">
                        <Text
                            className={`text-sm font-semibold ${involved ? 'text-gray-900' : 'text-gray-600'}`}
                            numberOfLines={1}
                        >
                            {rowLabel}
                        </Text>
                        {!involved && (
                            <Text className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
                                {t('settleUp.notInvolved')}
                            </Text>
                        )}
                    </View>

                    <View className="items-end pl-2">
                        <Text
                            className={`text-base font-bold ${
                                !involved
                                    ? 'text-gray-500'
                                    : debt.toUserId === currentUserId
                                      ? 'text-green-500'
                                      : 'text-red-500'
                            }`}
                        >
                            {debt.currency} {debt.amount.toFixed(2)}
                        </Text>
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
                                testID={
                                    'convert-btn-' +
                                    debt.fromUserId +
                                    '-' +
                                    debt.toUserId +
                                    '-' +
                                    debt.currency
                                }
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
                                testID={'remind-btn-' + debt.fromUserId + '-' + debt.toUserId}
                            >
                                <Text className="text-xs font-medium text-primary">
                                    {t('remind.sendReminderButton')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}
