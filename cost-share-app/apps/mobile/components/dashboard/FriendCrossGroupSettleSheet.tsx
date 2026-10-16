/**
 * Cross-group settlement with a single target currency — one batch/settlement per shared group.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    buildFriendCrossGroupSettlePreview,
    FriendBalanceSummary,
    shouldShowPaidInCurrencyNote,
} from '@cost-share/shared';
import { CenterDialogShell } from '../CenterDialogShell';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { CurrencyPicker } from '../CurrencyPicker';
import { useSimplifiedDebts } from '../../hooks/useSimplifiedDebts';
import { useExchangeRatesQuery } from '../../hooks/queries/useExchangeRatesQuery';
import { createConsolidationBatch } from '../../services/consolidation.service';
import { createSettlement } from '../../services/settlements.service';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { formatCurrencyAmount } from '../../lib/currencyDisplay';
import { colors } from '../../theme';
import { getDisplayNameForFriend } from '../../lib/userDisplay';

type Step = 'pick-currency' | 'confirm';

interface Props {
    visible: boolean;
    friend: FriendBalanceSummary | null;
    currentUserId: string | null;
    defaultCurrency: string;
    /** When true, skip currency pick and open on confirm with default currency. */
    quickSettle?: boolean;
    onClose: () => void;
    onCompleted?: () => void;
}

export function FriendCrossGroupSettleSheet({
    visible,
    friend,
    currentUserId,
    defaultCurrency,
    quickSettle = false,
    onClose,
    onCompleted,
}: Props) {
    const { t } = useTranslation();
    const { data: simplified } = useSimplifiedDebts();
    const [step, setStep] = useState<Step>('pick-currency');
    const [targetCurrency, setTargetCurrency] = useState(defaultCurrency);
    const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const wasVisible = useRef(false);

    const friendId = friend?.userId ?? null;
    const sharedGroupIds = friend?.sharedGroupIds ?? [];

    const previewCurrencies = useMemo(() => {
        if (!simplified || !friendId || !currentUserId) return [];
        const preview = buildFriendCrossGroupSettlePreview(
            simplified,
            currentUserId,
            friendId,
            sharedGroupIds,
            defaultCurrency,
            defaultCurrency,
        );
        return preview.perCurrency.map(l => l.currency);
    }, [simplified, friendId, currentUserId, sharedGroupIds, defaultCurrency]);

    const fxSymbols = useMemo(() => {
        const set = new Set(previewCurrencies);
        if (targetCurrency && targetCurrency !== defaultCurrency) set.add(targetCurrency);
        set.delete(defaultCurrency);
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [previewCurrencies, targetCurrency, defaultCurrency]);

    const { data: rates } = useExchangeRatesQuery(defaultCurrency, fxSymbols);
    const ratesFromBase = rates?.rates;

    const preview = useMemo(() => {
        if (!simplified || !friendId || !currentUserId) return null;
        return buildFriendCrossGroupSettlePreview(
            simplified,
            currentUserId,
            friendId,
            sharedGroupIds,
            defaultCurrency,
            targetCurrency,
            ratesFromBase,
        );
    }, [
        simplified,
        friendId,
        currentUserId,
        sharedGroupIds,
        defaultCurrency,
        targetCurrency,
        ratesFromBase,
    ]);

    useEffect(() => {
        if (visible && !wasVisible.current) {
            setTargetCurrency(defaultCurrency);
            setStep(quickSettle ? 'confirm' : 'pick-currency');
            setCurrencyPickerOpen(false);
            setSubmitting(false);
        }
        wasVisible.current = visible;
    }, [visible, defaultCurrency, quickSettle]);

    const friendName = friend ? getDisplayNameForFriend(friend, t) : '';

    const handleConfirm = useCallback(async () => {
        if (!preview || !currentUserId || preview.conversionFailed || submitting) return;
        if (preview.groupPlans.length === 0) return;
        setSubmitting(true);
        try {
            const settlementDate = new Date();
            for (const plan of preview.groupPlans) {
                if (plan.useConsolidationBatch) {
                    await createConsolidationBatch({
                        groupId: plan.groupId,
                        fromUserId: plan.netPayerId,
                        toUserId: plan.netReceiverId,
                        paymentCurrency: plan.targetCurrency,
                        paymentAmount: plan.netAmount,
                        settlementDate,
                        settlements: plan.settlements,
                    });
                } else {
                    const debt = plan.debts[0];
                    await createSettlement({
                        groupId: plan.groupId,
                        fromUserId: debt.fromUserId,
                        toUserId: debt.toUserId,
                        amount: debt.amount,
                        currency: debt.currency,
                        paymentMethod: 'cash',
                        settlementDate,
                    });
                }
                invalidateBalanceCaches(plan.groupId);
            }
            void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts });
            void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
            onCompleted?.();
            onClose();
        } finally {
            setSubmitting(false);
        }
    }, [preview, currentUserId, submitting, onClose, onCompleted]);

    const label =
        step === 'confirm'
            ? t('dashboard.friendCrossSettleConfirmTitle')
            : t('dashboard.friendCrossSettlePickTitle');

    const leftAction =
        step === 'confirm' && !quickSettle
            ? { label: t('common.back'), onPress: () => setStep('pick-currency') }
            : undefined;

    const showPaidNote =
        preview &&
        shouldShowPaidInCurrencyNote(
            preview.targetCurrency,
            preview.groupPlans.flatMap(p => p.debts.map(d => d.currency)),
        );

    return (
        <CenterDialogShell
            visible={visible}
            label={label}
            onClose={onClose}
            leftLabel={leftAction?.label}
            onLeftPress={leftAction?.onPress}
            saveLabel={step === 'confirm' ? t('dashboard.friendCrossSettleConfirmButton') : undefined}
            onSave={step === 'confirm' ? handleConfirm : undefined}
            saveDisabled={
                step === 'confirm'
                    ? submitting ||
                      !preview ||
                      preview.conversionFailed ||
                      preview.groupPlans.length === 0
                    : false
            }
        >
            {step === 'pick-currency' && (
                <View className="px-4 pb-6 pt-2 gap-3">
                    {previewCurrencies.map(currency => (
                        <TouchableOpacity
                            key={currency}
                            onPress={() => {
                                setTargetCurrency(currency);
                                setStep('confirm');
                            }}
                            activeOpacity={0.8}
                            className={`rounded-2xl py-4 px-5 items-center border ${
                                targetCurrency === currency
                                    ? 'bg-primary border-primary'
                                    : 'bg-white border-gray-200'
                            }`}
                            testID={`friend-cross-currency-${currency}`}
                        >
                            <Text
                                className={`font-semibold text-base text-center w-full ${
                                    targetCurrency === currency ? 'text-white' : 'text-gray-800'
                                }`}
                            >
                                {currency}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        onPress={() => setCurrencyPickerOpen(true)}
                        activeOpacity={0.7}
                        className="rounded-2xl py-4 px-5 flex-row items-center justify-center gap-2 border border-dashed border-gray-300"
                        testID="friend-cross-currency-other"
                    >
                        <AppIcon name="add-circle-outline" size={18} color={colors.gray500} />
                        <Text className="text-gray-500 font-medium text-base text-center">
                            {t('consolidation.otherCurrency')}
                        </Text>
                    </TouchableOpacity>
                    <CurrencyPicker
                        value={targetCurrency}
                        onChange={currency => {
                            setTargetCurrency(currency);
                            setCurrencyPickerOpen(false);
                            setStep('confirm');
                        }}
                        visible={currencyPickerOpen}
                        onClose={() => setCurrencyPickerOpen(false)}
                    />
                </View>
            )}

            {step === 'confirm' && preview && (
                <View className="px-4 pb-4 pt-2 gap-3">
                    {preview.conversionFailed ? (
                        <Text className="text-sm text-red-600 text-center">
                            {t('dashboard.conversionFailed')}
                        </Text>
                    ) : (
                        <>
                            <View className="bg-slate-50 rounded-2xl p-4 gap-2">
                                <Text className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                                    {t('dashboard.friendCrossSettleNetLabel')}
                                </Text>
                                <Text className="text-lg font-semibold text-gray-900">
                                    {formatCurrencyAmount(
                                        preview.netAmountInTarget,
                                        preview.targetCurrency,
                                    )}
                                </Text>
                                <Text className="text-sm text-slate-600">
                                    {preview.netPayerId === currentUserId
                                        ? t('dashboard.friendCrossSettleYouPay', { name: friendName })
                                        : t('dashboard.friendCrossSettleTheyPay', { name: friendName })}
                                </Text>
                            </View>

                            {preview.perCurrency.map(line => (
                                <View
                                    key={line.currency}
                                    style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                                >
                                    <Text className="text-sm text-slate-600">{line.currency}</Text>
                                    <Text className="text-sm font-medium text-gray-900">
                                        {formatCurrencyAmount(
                                            Math.abs(line.netAmount),
                                            line.currency,
                                        )}
                                    </Text>
                                </View>
                            ))}

                            {showPaidNote ? (
                                <Text className="text-xs text-slate-500">
                                    {t('settleUp.paidInCurrency', {
                                        currency: preview.targetCurrency,
                                    })}
                                </Text>
                            ) : null}

                            <Text className="text-xs text-slate-500 mt-1">
                                {t('dashboard.friendCrossSettleGroupsHint', {
                                    count: preview.groupPlans.length,
                                })}
                            </Text>
                        </>
                    )}
                    {submitting ? (
                        <ActivityIndicator className="py-2" color={colors.primary} />
                    ) : null}
                </View>
            )}
        </CenterDialogShell>
    );
}
