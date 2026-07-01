/**
 * ConsolidateCurrencySheet — ad-gated "convert all currencies" flow for debts
 * between exactly two users within a group.
 *
 * Step flow:  gate → pick-currency → confirm
 *
 * Key invariant: debts in a pair can go in BOTH directions (I owe some
 * currencies, they owe me others). Amounts are signed from currentUser's
 * perspective: positive = counterpart owes me, negative = I owe them.
 * The net signed total determines who pays whom in the final settlement.
 *
 * On confirm, fires onReadyToSettle with all the data the parent needs to
 * open the SettleUpSheet pre-filled — no mutation happens here.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GroupMemberLite, PairwiseDebt } from '@cost-share/shared';
import { CenterDialogShell } from './CenterDialogShell';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { AdGateStep } from './remind/AdGateStep';
import { CurrencyPicker } from './CurrencyPicker';
import { useExchangeRatesQuery } from '../hooks/queries/useExchangeRatesQuery';
import { colors } from '../theme';

export interface ConsolidatePair {
    fromUserId: string;
    toUserId: string;
    debts: PairwiseDebt[];
}

/** Passed to onReadyToSettle so the parent can open SettleUpSheet pre-filled. */
export interface ConsolidationSettleData {
    netPayerId: string;
    netReceiverId: string;
    netAmount: number;
    targetCurrency: string;
    pair: ConsolidatePair;
    /** Per-debt exchange rate records for createConsolidationBatch — each carries the original debt direction. */
    settlements: Array<{ currency: string; amount: number; exchangeRate: number; fromUserId: string; toUserId: string }>;
}

interface ConsolidateCurrencySheetProps {
    visible: boolean;
    pair: ConsolidatePair | null;
    currentUserId: string;
    memberMap: Record<string, GroupMemberLite>;
    onClose: () => void;
    /** Called when user confirms the conversion summary — open SettleUpSheet. */
    onReadyToSettle: (data: ConsolidationSettleData) => void;
}

type Step = 'gate' | 'pick-currency' | 'confirm';

/** +1 if the debt is owed TO refUserId, -1 if refUserId owes it. */
function debtSign(debt: PairwiseDebt, refUserId: string): 1 | -1 {
    return debt.toUserId === refUserId ? 1 : -1;
}

export function ConsolidateCurrencySheet({
    visible,
    pair,
    currentUserId,
    memberMap,
    onClose,
    onReadyToSettle,
}: ConsolidateCurrencySheetProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('gate');
    const [targetCurrency, setTargetCurrency] = useState('');
    const [openSeq, setOpenSeq] = useState(0);
    const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
    const wasVisible = useRef(false);

    const currencies = useMemo(
        () => [...new Set((pair?.debts ?? []).map(d => d.currency))],
        [pair],
    );

    // Whether the current user is one of the two debt parties.
    const isInvolved = pair
        ? (pair.fromUserId === currentUserId || pair.toUserId === currentUserId)
        : true;

    // For involved users: the other party. For non-involved: arbitrary (only
    // used in involved display paths, so the value doesn't matter otherwise).
    const counterpartId = useMemo(() => {
        if (!pair) return '';
        return pair.fromUserId === currentUserId ? pair.toUserId : pair.fromUserId;
    }, [pair, currentUserId]);

    const counterpartName = useMemo(
        () => memberMap[counterpartId]?.displayName ?? '',
        [memberMap, counterpartId],
    );

    useEffect(() => {
        if (visible && !wasVisible.current) {
            setStep('gate');
            setTargetCurrency(currencies[0] ?? '');
            setOpenSeq(s => s + 1);
            setCurrencyPickerOpen(false);
        }
        wasVisible.current = visible;
    }, [visible, currencies]);

    // FX query base = currencies[0]. Symbols include all debt currencies plus
    // the target if the user picked a third currency from the full picker.
    const fxBase = currencies[0] ?? 'USD';
    const fxSymbols = useMemo(() => {
        const base = new Set(currencies.length > 1 ? currencies : []);
        if (targetCurrency && !base.has(targetCurrency) && targetCurrency !== fxBase) {
            base.add(targetCurrency);
        }
        return [...base];
    }, [currencies, targetCurrency, fxBase]);

    const { data: rates } = useExchangeRatesQuery(fxBase, fxSymbols);
    const ratesFromBase = rates?.rates ?? null;

    // Convert any amount between two currencies using fxBase as pivot.
    // ratesFromBase[X] = units of X per 1 fxBase.
    const convertAmount = useCallback(
        (amount: number, from: string, to: string): number | null => {
            if (from === to) return amount;
            if (!ratesFromBase) return null;
            let inBase: number;
            if (from === fxBase) {
                inBase = amount;
            } else {
                const rate = ratesFromBase[from];
                if (!rate || rate <= 0 || !Number.isFinite(rate)) return null;
                inBase = amount / rate;
            }
            if (to === fxBase) return Number(inBase.toFixed(2));
            const toRate = ratesFromBase[to];
            if (!toRate || toRate <= 0 || !Number.isFinite(toRate)) return null;
            return Number((inBase * toRate).toFixed(2));
        },
        [ratesFromBase, fxBase],
    );

    /**
     * Signed net total in targetCurrency from refUser's perspective.
     * refUser = currentUserId when involved, pair.fromUserId when not.
     * Positive → the other party owes refUser.
     * Negative → refUser owes the other party.
     */
    const signedPreview = useMemo((): number | null => {
        if (!pair || !targetCurrency) return null;
        const refId = isInvolved ? currentUserId : pair.fromUserId;
        const needsFx = pair.debts.some(d => d.currency !== targetCurrency);
        let total = 0;
        for (const debt of pair.debts) {
            const sign = debtSign(debt, refId);
            if (!needsFx) {
                total += sign * debt.amount;
            } else {
                const converted = convertAmount(debt.amount, debt.currency, targetCurrency);
                if (converted === null) return null;
                total += sign * converted;
            }
        }
        return Number(total.toFixed(2));
    }, [pair, targetCurrency, isInvolved, currentUserId, convertAmount]);

    // Net payer/receiver always set to the actual debt parties (never currentUser
    // when not involved), so the data passed to SettleUpSheet is correct.
    const netPayerId = useMemo(() => {
        if (!pair || signedPreview === null) return '';
        if (isInvolved) {
            return signedPreview >= 0 ? counterpartId : currentUserId;
        }
        // signedPreview >= 0 → pair.toUserId owes pair.fromUserId → pair.toUserId pays
        return signedPreview >= 0 ? pair.toUserId : pair.fromUserId;
    }, [pair, signedPreview, isInvolved, counterpartId, currentUserId]);

    const netReceiverId = useMemo(() => {
        if (!pair || !netPayerId) return '';
        if (isInvolved) {
            return netPayerId === currentUserId ? counterpartId : currentUserId;
        }
        return netPayerId === pair.fromUserId ? pair.toUserId : pair.fromUserId;
    }, [pair, netPayerId, isInvolved, currentUserId, counterpartId]);

    const netAmount = signedPreview !== null ? Math.abs(signedPreview) : null;

    const netPayerName = isInvolved
        ? (netPayerId === currentUserId ? t('common.you') : counterpartName)
        : (memberMap[netPayerId]?.displayName ?? '');
    const netReceiverName = isInvolved
        ? (netReceiverId === currentUserId ? t('common.you') : counterpartName)
        : (memberMap[netReceiverId]?.displayName ?? '');

    const handleGateCompleted = useCallback(() => {
        setStep('pick-currency');
    }, []);

    const handleConfirm = useCallback(() => {
        if (!pair || netAmount === null || netAmount < 0.01 || !netPayerId || !netReceiverId) return;
        const settlements = pair.debts.map(debt => ({
            currency: debt.currency,
            amount: debt.amount,
            exchangeRate: convertAmount(1, debt.currency, targetCurrency) ?? 1,
            fromUserId: debt.fromUserId,
            toUserId: debt.toUserId,
        }));
        onReadyToSettle({
            netPayerId,
            netReceiverId,
            netAmount,
            targetCurrency,
            pair,
            settlements,
        });
    }, [pair, netAmount, netPayerId, netReceiverId, targetCurrency, convertAmount, onReadyToSettle]);

    const label =
        step === 'confirm'
            ? t('consolidation.confirmTitle')
            : step === 'pick-currency'
              ? t('consolidation.pickCurrencyTitle')
              : t('consolidation.gateTitle');

    const leftAction =
        step === 'confirm'
            ? { label: t('common.back'), onPress: () => setStep('pick-currency') }
            : undefined;

    return (
        <CenterDialogShell
            visible={visible}
            label={label}
            onClose={onClose}
            leftLabel={leftAction?.label}
            onLeftPress={leftAction?.onPress}
            saveLabel={step === 'confirm' ? t('consolidation.confirmButton') : undefined}
            onSave={step === 'confirm' ? handleConfirm : undefined}
            saveDisabled={step === 'confirm' ? netAmount === null : false}
        >
            {step === 'gate' && (
                <AdGateStep
                    key={openSeq}
                    active={visible}
                    featureKey="consolidate_currency"
                    onCompleted={handleGateCompleted}
                />
            )}

            {step === 'pick-currency' && (
                <View className="px-4 pb-6 pt-2 gap-3">
                    {currencies.map(currency => (
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
                            testID={`consolidate-currency-${currency}`}
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

                    {/* Other currency picker */}
                    <TouchableOpacity
                        onPress={() => setCurrencyPickerOpen(true)}
                        activeOpacity={0.7}
                        className="rounded-2xl py-4 px-5 flex-row items-center justify-center gap-2 border border-dashed border-gray-300"
                        testID="consolidate-currency-other"
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

            {step === 'confirm' && (
                <View className="px-4 pb-1 pt-2 gap-1">
                    <View className="bg-blue-50 rounded-2xl p-4 gap-2">
                        <Text className="text-gray-500 text-xs uppercase tracking-wide font-medium">
                            {t('consolidation.summaryLabel')}
                        </Text>

                        {/* Per-debt rows with direction */}
                        {(pair?.debts ?? []).map(debt => {
                            let payerName: string;
                            let receiverName: string;
                            let isOwedToMe: boolean;
                            if (isInvolved) {
                                const sign = debtSign(debt, currentUserId);
                                isOwedToMe = sign === 1;
                                payerName = isOwedToMe ? counterpartName : t('common.you');
                                receiverName = isOwedToMe ? t('common.you') : counterpartName;
                            } else {
                                // Show actual names; no "You" perspective
                                payerName = memberMap[debt.fromUserId]?.displayName ?? debt.fromUserId;
                                receiverName = memberMap[debt.toUserId]?.displayName ?? debt.toUserId;
                                isOwedToMe = false;
                            }
                            return (
                                <View
                                    key={`${debt.currency}-${debt.fromUserId}`}
                                    className="flex-row items-center justify-between"
                                >
                                    {/* Direction label */}
                                    <View className="flex-row items-center gap-1 flex-1 mr-3">
                                        <View
                                            className={`w-5 h-5 rounded-full items-center justify-center ${
                                                isInvolved
                                                    ? (isOwedToMe ? 'bg-green-100' : 'bg-red-100')
                                                    : 'bg-gray-100'
                                            }`}
                                        >
                                            <AppIcon
                                                name={isInvolved
                                                    ? (isOwedToMe ? 'arrow-down' : 'arrow-up')
                                                    : 'arrow-forward'}
                                                size={11}
                                                color={isInvolved
                                                    ? (isOwedToMe ? colors.success.DEFAULT : colors.error)
                                                    : colors.gray500}
                                            />
                                        </View>
                                        <Text
                                            className="text-gray-600 text-xs"
                                            numberOfLines={1}
                                            style={{ writingDirection: 'ltr', textAlign: 'left' }}
                                        >
                                            {payerName} → {receiverName}
                                        </Text>
                                    </View>
                                    {/* Amount */}
                                    <Text
                                        className={`text-sm font-semibold ${
                                            isInvolved
                                                ? (isOwedToMe ? 'text-green-700' : 'text-red-600')
                                                : 'text-gray-700'
                                        }`}
                                    >
                                        {isInvolved ? (isOwedToMe ? '+' : '−') : '−'} {debt.currency} {debt.amount.toFixed(2)}
                                    </Text>
                                </View>
                            );
                        })}

                        {/* Net total */}
                        <View className="border-t border-blue-100 mt-1 pt-3 gap-1">
                            <View className="flex-row justify-between items-center">
                                <Text className="text-gray-700 text-sm font-semibold">
                                    {t('consolidation.netLabel')}
                                </Text>
                                {netAmount !== null ? (
                                    <Text className="text-gray-900 text-sm font-bold">
                                        {targetCurrency} {netAmount.toFixed(2)}
                                    </Text>
                                ) : (
                                    <ActivityIndicator size="small" />
                                )}
                            </View>
                            {netAmount !== null && (
                                <Text className="text-gray-500 text-xs">
                                    {isInvolved
                                        ? (netPayerId === counterpartId
                                            ? t('consolidation.netDirectionTheyPayYou', { name: counterpartName })
                                            : t('consolidation.netDirectionYouPayThem', { name: counterpartName }))
                                        : t('consolidation.netDirectionThirdParty', { from: netPayerName, to: netReceiverName })}
                                </Text>
                            )}
                        </View>
                    </View>

                    <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>
                        {t('consolidation.rateDisclaimer')}
                    </Text>
                </View>
            )}
        </CenterDialogShell>
    );
}
