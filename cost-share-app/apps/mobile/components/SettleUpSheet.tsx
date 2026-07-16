/**
 * SettleUpSheet — bottom-sheet form for recording / editing a settlement.
 * Design: docs/design_handoff_settle/README.md.
 *
 * Layout:
 *   ┌ Cancel · SETTLE UP · Save ────────────┐  (BottomSheetShell header)
 *   │ Emerald hero: From → amount → To       │
 *   │ Method tiles (Cash · Bank · PP · Other)│
 *   │ Date chip + "Record payment · USD X.XX"│  (bottom dock)
 *   └────────────────────────────────────────┘
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { GroupMemberLite, PairwiseDebt, PaymentMethod } from '@cost-share/shared';
import { Text } from './AppText';
import { Button } from './Button';
import { MemberAvatar } from './MemberAvatar';
import { AppIcon } from './AppIcon';
import type { AppIconName } from './AppIcon';
import { BottomSheetShell } from './BottomSheetShell';
import { DatePickerPopup } from './expenseV2/DatePickerPopup';
import {
    CurrencyPickerPopup,
    type CurrencyPickerOption,
} from './expenseV2/CurrencyPickerPopup';
import { MemberPickerPopup } from './expenseV2/MemberPickerPopup';
import { CurrencyPicker } from './CurrencyPicker';
import { rtlRowStyle, useRtlLayout } from '../hooks/useRtlLayout';
import { getAvatarUrlForMember } from '../lib/userDisplay';

export interface SettleUpFormValues {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
    paymentMethod: PaymentMethod;
    settlementDate: Date;
}

interface SettleUpSheetProps {
    visible: boolean;
    members: GroupMemberLite[];
    pairwiseDebts: PairwiseDebt[];
    currentUserId: string;
    initial: {
        fromUserId: string;
        toUserId: string;
        currency: string;
        amount: number;
        paymentMethod?: PaymentMethod;
        settlementDate?: Date;
    };
    groupName?: string;
    mode: 'create' | 'edit';
    /**
     * When true, the user can change the payer and receiver by tapping the
     * hero avatars, and the currency picker shows every currency present in
     * the group's debts (not only those between the current from/to pair).
     * Used by the "Record a payment" CTA on the settle-up list screen.
     */
    allowParticipantEdit?: boolean;
    submitting?: boolean;
    /**
     * When this is a consolidation settlement, pass the original per-currency
     * debts here. A "Settling debts" section is rendered below the payment form
     * showing what this payment consolidates.
     */
    consolidationDebts?: PairwiseDebt[];
    consolidationMemberMap?: Record<string, GroupMemberLite>;
    onSubmit: (values: SettleUpFormValues) => Promise<void> | void;
    onClose: () => void;
}

type MethodKey = Extract<PaymentMethod, 'cash' | 'credit_card' | 'paypal'>;

const METHOD_TILES: ReadonlyArray<{ key: MethodKey; icon: AppIconName }> = [
    { key: 'cash', icon: 'cash-outline' },
    { key: 'credit_card', icon: 'card-outline' },
    { key: 'paypal', icon: 'logo-paypal' },
];

const DEFAULT_METHOD: MethodKey = 'cash';

function normalizeMethodKey(method: PaymentMethod | undefined): MethodKey {
    if (method === 'cash' || method === 'credit_card' || method === 'paypal') {
        return method;
    }
    return DEFAULT_METHOD;
}

const formatAmountText = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '');
const formatShortDate = (d: Date, locale: string) =>
    d.toLocaleDateString(locale === 'he' ? 'he-IL' : locale, { month: 'short', day: 'numeric' });

const FLOW_SIDE_WIDTH = 96;
const AMOUNT_FONT_SIZE = 26;
const AMOUNT_BOX_PAD_X = 12;
/** ~tabular digit advance at 26px/700 — native fallback before layout. */
const AMOUNT_CHAR_WIDTH = 15.5;

let webMeasureCanvas: HTMLCanvasElement | null = null;

/**
 * Content width of the amount digits. On web, TextInput defaults to 100% of its
 * parent — so we must set an explicit width *before* first paint. Canvas
 * measureText is synchronous and content-sized; onLayout alone is too late
 * (parent already expanded).
 */
function measureSettleAmountWidth(text: string): number {
    const sample = text.length > 0 ? text : '0';
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        webMeasureCanvas ??= document.createElement('canvas');
        const ctx = webMeasureCanvas.getContext('2d');
        if (ctx) {
            ctx.font = `700 ${AMOUNT_FONT_SIZE}px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;
            const letterSpacing = -0.02 * AMOUNT_FONT_SIZE;
            return Math.ceil(ctx.measureText(sample).width + Math.abs(letterSpacing) * sample.length);
        }
    }
    return Math.ceil(Math.max(sample.length, 1) * AMOUNT_CHAR_WIDTH);
}

export function SettleUpSheet({
    visible,
    members,
    pairwiseDebts,
    currentUserId: _currentUserId,
    initial,
    groupName,
    mode,
    allowParticipantEdit = false,
    submitting = false,
    consolidationDebts,
    consolidationMemberMap,
    onSubmit,
    onClose,
}: SettleUpSheetProps) {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();

    const [fromUserId, setFromUserId] = useState(initial.fromUserId);
    const [toUserId, setToUserId] = useState(initial.toUserId);
    const [currency, setCurrency] = useState(initial.currency);
    const [amountText, setAmountText] = useState(formatAmountText(initial.amount));
    const [paymentMethod, setPaymentMethod] = useState<MethodKey>(
        normalizeMethodKey(initial.paymentMethod),
    );
    const [settlementDate, setSettlementDate] = useState<Date>(
        initial.settlementDate ?? new Date()
    );
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
    const [fromPickerOpen, setFromPickerOpen] = useState(false);
    const [toPickerOpen, setToPickerOpen] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setFromUserId(initial.fromUserId);
        setToUserId(initial.toUserId);
        setCurrency(initial.currency);
        setAmountText(formatAmountText(initial.amount));
        setPaymentMethod(normalizeMethodKey(initial.paymentMethod));
        setSettlementDate(initial.settlementDate ?? new Date());
    }, [
        visible,
        initial.fromUserId,
        initial.toUserId,
        initial.currency,
        initial.amount,
        initial.paymentMethod,
        initial.settlementDate,
    ]);

    const owedCurrencyOptions = useMemo<CurrencyPickerOption[]>(() => {
        const pairMatches = pairwiseDebts
            .filter(
                d =>
                    d.fromUserId === fromUserId &&
                    d.toUserId === toUserId &&
                    d.amount > 0,
            )
            .map(d => ({ currency: d.currency, amount: d.amount }));

        if (allowParticipantEdit) {
            // Record-arbitrary-payment: offer every currency present in the
            // group's debts, plus whatever is currently selected.
            const seen = new Set<string>();
            const merged: CurrencyPickerOption[] = [];
            for (const opt of pairMatches) {
                if (seen.has(opt.currency)) continue;
                seen.add(opt.currency);
                merged.push(opt);
            }
            for (const d of pairwiseDebts) {
                if (seen.has(d.currency)) continue;
                seen.add(d.currency);
                merged.push({ currency: d.currency, amount: 0 });
            }
            if (!seen.has(currency)) {
                merged.unshift({ currency, amount: 0 });
            }
            return merged;
        }

        if (pairMatches.some(o => o.currency === initial.currency)) {
            return pairMatches;
        }
        return [
            { currency: initial.currency, amount: initial.amount },
            ...pairMatches,
        ];
    }, [
        pairwiseDebts,
        fromUserId,
        toUserId,
        initial.currency,
        initial.amount,
        allowParticipantEdit,
        currency,
    ]);

    // In record-arbitrary-payment mode the user can pick any currency from the
    // full ISO catalog, so the chip is always interactive.
    const canPickCurrency =
        allowParticipantEdit ||
        (mode === 'create' && owedCurrencyOptions.length > 1);

    const parsedAmount = useMemo(() => {
        const n = parseFloat(amountText.replace(',', '.'));
        return Number.isFinite(n) ? n : NaN;
    }, [amountText]);

    const memberById = useMemo(() => {
        const map = new Map<string, GroupMemberLite>();
        members.forEach(m => map.set(m.userId, m));
        return map;
    }, [members]);

    // Deleted (soft-deleted) accounts must not be selectable as payer/receiver
    // when recording an arbitrary payment.
    const activeMembers = useMemo(
        () => members.filter(m => m.isActive),
        [members],
    );

    const fromMember = memberById.get(fromUserId);
    const toMember = memberById.get(toUserId);

    const sameParticipant =
        Boolean(fromUserId) && fromUserId === toUserId;

    const recordDisabled =
        submitting ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0 ||
        !fromUserId ||
        !toUserId ||
        sameParticipant;

    const handleCurrencySelected = useCallback(
        (option: CurrencyPickerOption) => {
            setCurrency(option.currency);
            setAmountText(formatAmountText(option.amount));
            setCurrencyPickerOpen(false);
        },
        [],
    );

    const handleSubmit = useCallback(async () => {
        if (recordDisabled) return;
        await onSubmit({
            fromUserId,
            toUserId,
            currency,
            amount: Number(parsedAmount.toFixed(2)),
            paymentMethod,
            settlementDate,
        });
    }, [
        recordDisabled,
        onSubmit,
        fromUserId,
        toUserId,
        currency,
        parsedAmount,
        paymentMethod,
        settlementDate,
    ]);

    const isConsolidation = consolidationDebts != null && consolidationDebts.length > 0;
    const label = mode === 'edit'
        ? t('settleUp.edit')
        : isConsolidation
            ? t('settleUp.convertedTitle')
            : t('settleUp.title');

    return (
        <BottomSheetShell
            visible={visible}
            label={label}
            onClose={onClose}
            onSave={handleSubmit}
            saveDisabled={recordDisabled}
        >
            <View style={{ flexShrink: 1 }}>
                <ScrollView
                    style={{ flexShrink: 1, flexGrow: 0 }}
                    contentContainerStyle={{ paddingBottom: 8 }}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                >
                    <SettleUpHero
                        fromMember={fromMember}
                        toMember={toMember}
                        currency={currency}
                        amountText={amountText}
                        onAmountChange={setAmountText}
                        amountLocked={isConsolidation}
                        canPickCurrency={canPickCurrency}
                        onOpenCurrencyPicker={() => setCurrencyPickerOpen(true)}
                        canPickParticipants={allowParticipantEdit}
                        onOpenFromPicker={() => setFromPickerOpen(true)}
                        onOpenToPicker={() => setToPickerOpen(true)}
                        onSwap={() => {
                            setFromUserId(toUserId);
                            setToUserId(fromUserId);
                        }}
                        groupName={groupName}
                        isRtl={isRtl}
                    />

                    {sameParticipant ? (
                        <View className="mx-4 mt-2">
                            <Text className="text-[12px] text-red-500">
                                {t('settleUp.sameParticipantError')}
                            </Text>
                        </View>
                    ) : null}

                    {consolidationDebts && consolidationDebts.length > 0 && (
                        <ConsolidationDebtList
                            debts={consolidationDebts}
                            memberMap={consolidationMemberMap ?? {}}
                            currentUserId={_currentUserId}
                        />
                    )}

                    <PaymentMethodSection
                        selected={paymentMethod}
                        onSelect={setPaymentMethod}
                        isRtl={isRtl}
                    />
                </ScrollView>

                <SettleUpBottomDock
                    settlementDate={settlementDate}
                    locale={i18n.language}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onRecord={handleSubmit}
                    recordDisabled={recordDisabled}
                    saveLabel={t('common.save')}
                    submitting={submitting}
                />

                <DatePickerPopup
                    visible={datePickerOpen}
                    initialDate={settlementDate}
                    onCancel={() => setDatePickerOpen(false)}
                    onConfirm={next => {
                        setSettlementDate(next);
                        setDatePickerOpen(false);
                    }}
                />

                {allowParticipantEdit ? (
                    <CurrencyPicker
                        value={currency}
                        onChange={next => {
                            setCurrency(next);
                            setCurrencyPickerOpen(false);
                        }}
                        visible={currencyPickerOpen}
                        onClose={() => setCurrencyPickerOpen(false)}
                    />
                ) : (
                    <CurrencyPickerPopup
                        visible={currencyPickerOpen}
                        options={owedCurrencyOptions}
                        selectedCurrency={currency}
                        onCancel={() => setCurrencyPickerOpen(false)}
                        onConfirm={handleCurrencySelected}
                    />
                )}

                {allowParticipantEdit ? (
                    <>
                        <MemberPickerPopup
                            visible={fromPickerOpen}
                            title={t('settleUp.memberPickerFromTitle')}
                            members={activeMembers}
                            selectedUserId={fromUserId}
                            disabledUserId={toUserId}
                            onCancel={() => setFromPickerOpen(false)}
                            onConfirm={member => {
                                setFromUserId(member.userId);
                                setFromPickerOpen(false);
                            }}
                        />
                        <MemberPickerPopup
                            visible={toPickerOpen}
                            title={t('settleUp.memberPickerToTitle')}
                            members={activeMembers}
                            selectedUserId={toUserId}
                            disabledUserId={fromUserId}
                            onCancel={() => setToPickerOpen(false)}
                            onConfirm={member => {
                                setToUserId(member.userId);
                                setToPickerOpen(false);
                            }}
                        />
                    </>
                ) : null}

            </View>
        </BottomSheetShell>
    );
}

/* ----- Hero ---------------------------------------------------------------- */

interface SettleUpHeroProps {
    fromMember: GroupMemberLite | undefined;
    toMember: GroupMemberLite | undefined;
    currency: string;
    amountText: string;
    onAmountChange: (v: string) => void;
    amountLocked?: boolean;
    canPickCurrency: boolean;
    onOpenCurrencyPicker: () => void;
    canPickParticipants: boolean;
    onOpenFromPicker: () => void;
    onOpenToPicker: () => void;
    onSwap: () => void;
    groupName?: string;
    isRtl: boolean;
}

function SettleUpHero({
    fromMember,
    toMember,
    currency,
    amountText,
    onAmountChange,
    amountLocked = false,
    canPickCurrency,
    onOpenCurrencyPicker,
    canPickParticipants,
    onOpenFromPicker,
    onOpenToPicker,
    onSwap,
    groupName,
    isRtl,
}: SettleUpHeroProps) {
    const { t } = useTranslation();
    return (
        <View className="mx-4 mt-3 rounded-2xl overflow-hidden border border-success-border">
            <LinearGradient
                colors={['#10B981', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 196 }}
            >
                <View className="flex-row items-center justify-between px-3 pt-2">
                    <View
                        className="flex-row items-center px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                    >
                        <AppIcon name="checkmark-circle" size={12} color="#FFFFFF" />
                        <Text className="text-white text-[11px] font-semibold ms-1">
                            {t('settleUp.newPayment')}
                        </Text>
                    </View>
                    {groupName ? (
                        <Text
                            className="text-[11px] font-medium"
                            style={{
                                color: 'rgba(255,255,255,0.92)',
                                textShadowColor: 'rgba(0,0,0,0.4)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 2,
                            }}
                            numberOfLines={1}
                        >
                            {groupName}
                        </Text>
                    ) : null}
                </View>

                <View
                    style={[heroStyles.flowRow, { direction: isRtl ? 'rtl' : 'ltr' }]}
                    {...(Platform.OS === 'web'
                        ? ({ dir: isRtl ? 'rtl' : 'ltr' } as const)
                        : {})}
                >
                    <View style={heroStyles.flowSide}>
                        <FlowAvatar
                            member={fromMember}
                            label={t('settleUp.from')}
                            onPress={canPickParticipants ? onOpenFromPicker : undefined}
                            testID="settle-from-avatar"
                        />
                    </View>

                    <View style={heroStyles.flowCenter}>
                        <SettleUpAmountField
                            amountText={amountText}
                            amountLocked={amountLocked}
                            onAmountChange={onAmountChange}
                        />

                        <CurrencyChip
                            currency={currency}
                            canPick={canPickCurrency}
                            onPress={onOpenCurrencyPicker}
                            label={t('settleUp.currency')}
                        />

                        <View style={[heroStyles.arrowRow, { direction: isRtl ? 'rtl' : 'ltr' }]}>
                            <View style={heroStyles.arrowLine} />
                            <AppIcon
                                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                                size={18}
                                color="rgba(255,255,255,0.95)"
                            />
                            <View style={heroStyles.arrowLine} />
                        </View>

                        {canPickParticipants ? (
                            <Pressable
                                onPress={onSwap}
                                testID="settle-swap-button"
                                className="flex-row items-center mt-2 rounded-full px-2.5 py-0.5"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.18)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.35)',
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t('settleUp.swap')}
                            >
                                <AppIcon name="swap-horizontal" size={12} color="#FFFFFF" />
                                <Text className="text-white text-[10px] font-bold ms-1">
                                    {t('settleUp.swap')}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>

                    <View style={heroStyles.flowSide}>
                        <FlowAvatar
                            member={toMember}
                            label={t('settleUp.to')}
                            onPress={canPickParticipants ? onOpenToPicker : undefined}
                            testID="settle-to-avatar"
                        />
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
}

interface SettleUpAmountFieldProps {
    amountText: string;
    amountLocked: boolean;
    onAmountChange: (value: string) => void;
}

/** Background pill hugs digit content — explicit width every render (web-safe). */
function SettleUpAmountField({
    amountText,
    amountLocked,
    onAmountChange,
}: SettleUpAmountFieldProps) {
    const fieldWidth = measureSettleAmountWidth(amountText);
    const wrapWidth = fieldWidth + AMOUNT_BOX_PAD_X * 2;

    return (
        <View
            style={[
                heroStyles.amountWrap,
                { width: wrapWidth },
                amountLocked
                    ? heroStyles.amountBoxLocked
                    : heroStyles.amountBoxEditable,
                Platform.OS === 'web' && heroStyles.amountWrapWeb,
            ]}
            {...(Platform.OS === 'web' ? ({ dir: 'ltr' } as const) : {})}
        >
            {amountLocked ? (
                <Text
                    style={[heroStyles.amountText, { width: fieldWidth }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    testID="settle-amount-locked"
                >
                    {amountText}
                </Text>
            ) : (
                <TextInput
                    value={amountText}
                    onChangeText={onAmountChange}
                    keyboardType="decimal-pad"
                    selectionColor="#FFFFFF"
                    style={[
                        heroStyles.amountText,
                        { width: fieldWidth },
                        Platform.OS === 'web' && heroStyles.amountInputWeb,
                    ]}
                    testID="settle-amount-input"
                />
            )}
        </View>
    );
}

interface FlowAvatarProps {
    member: GroupMemberLite | undefined;
    label: string;
    onPress?: () => void;
    testID?: string;
}

const heroStyles = StyleSheet.create({
    flowRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    flowSide: {
        width: FLOW_SIDE_WIDTH,
        alignItems: 'center',
    },
    flowCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
    },
    amountWrap: {
        alignSelf: 'center',
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: 12,
        paddingHorizontal: AMOUNT_BOX_PAD_X,
        paddingVertical: 4,
        direction: 'ltr',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    amountWrapWeb: {
        display: 'inline-flex',
        maxWidth: '100%',
    } as const,
    amountText: {
        color: '#FFFFFF',
        fontSize: AMOUNT_FONT_SIZE,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        letterSpacing: -0.02 * AMOUNT_FONT_SIZE,
        padding: 0,
        margin: 0,
        textAlign: 'center',
        flexGrow: 0,
        flexShrink: 0,
    },
    amountInputWeb: {
        outlineStyle: 'none',
        borderWidth: 0,
        backgroundColor: 'transparent',
        boxSizing: 'content-box',
        maxWidth: '100%',
    } as const,
    amountBoxEditable: {
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.32)',
    },
    amountBoxLocked: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    arrowRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        width: '75%',
        maxWidth: 220,
    },
    arrowLine: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.85)',
    },
});

function FlowAvatar({ member, label, onPress, testID }: FlowAvatarProps) {
    const Wrapper: React.ComponentType<any> = onPress ? Pressable : View;
    const wrapperProps = onPress
        ? {
              onPress,
              accessibilityRole: 'button' as const,
              accessibilityLabel: label,
              testID,
          }
        : { testID };
    return (
        <Wrapper {...wrapperProps} style={{ width: 96 }} className="items-center">
            <View
                style={{
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    borderRadius: 999,
                    shadowColor: '#FFFFFF',
                    shadowOpacity: 0.25,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 0 },
                }}
            >
                <MemberAvatar
                    name={member?.displayName ?? '?'}
                    avatarUrl={getAvatarUrlForMember(member)}
                    pixelSize={44}
                />
            </View>
            <Text
                className="text-[13px] font-bold text-white mt-1"
                style={{
                    textShadowColor: 'rgba(0,0,0,0.35)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                }}
                numberOfLines={1}
            >
                {member?.displayName ?? ''}
            </Text>
            <Text
                className="text-[9px] font-bold uppercase mt-0.5"
                style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: 0.08 * 9 }}
            >
                {label}
            </Text>
        </Wrapper>
    );
}

/* ----- Currency chip ------------------------------------------------------- */

interface CurrencyChipProps {
    currency: string;
    canPick: boolean;
    onPress: () => void;
    label: string;
}

function CurrencyChip({ currency, canPick, onPress, label }: CurrencyChipProps) {
    const chipStyle = {
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    } as const;

    if (!canPick) {
        return (
            <View
                testID="settle-currency-chip-static"
                className="flex-row items-center mt-2 rounded-full px-2 py-0.5"
                style={chipStyle}
            >
                <Text className="text-white text-[10px] font-bold">{currency}</Text>
            </View>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            testID="settle-currency-chip"
            className="flex-row items-center mt-2 rounded-full px-2 py-0.5"
            style={chipStyle}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Text className="text-white text-[10px] font-bold mr-1">{currency}</Text>
            <AppIcon name="chevron-down" size={10} color="#FFFFFF" />
        </Pressable>
    );
}

/* ----- Payment method + app launchers -------------------------------------- */

interface PaymentMethodSectionProps {
    selected: MethodKey;
    onSelect: (m: MethodKey) => void;
    isRtl: boolean;
}

function PaymentMethodSection({ selected, onSelect, isRtl }: PaymentMethodSectionProps) {
    const { t } = useTranslation();

    return (
        <View className="px-4 pt-4 self-stretch">
            <SectionLabel isRtl={isRtl} title={t('settleUp.methodType')} />
            <MethodTiles selected={selected} onSelect={onSelect} t={t} isRtl={isRtl} />
        </View>
    );
}

function SectionLabel({
    title,
    subtitle,
    isRtl: _isRtl,
}: {
    title: string;
    subtitle?: string;
    isRtl: boolean;
}) {
    return (
        <View className="mb-2.5 self-stretch">
            <Text className="text-[11px] font-bold text-gray-600">{title}</Text>
            {subtitle ? (
                <Text className="text-[11px] text-gray-400 mt-0.5">{subtitle}</Text>
            ) : null}
        </View>
    );
}

interface MethodTilesProps {
    selected: MethodKey;
    onSelect: (m: MethodKey) => void;
    t: (key: string) => string;
    isRtl: boolean;
}

function MethodTiles({ selected, onSelect, t, isRtl }: MethodTilesProps) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
            <View style={[rtlRowStyle(isRtl), { gap: 10 }]}>
                {METHOD_TILES.map(({ key, icon }) => {
                    const isSelected = key === selected;
                    const label = t(`balances.methods.${key}`);
                    return (
                        <Pressable
                            key={key}
                            onPress={() => onSelect(key)}
                            testID={`method-tile-${key}`}
                            accessibilityRole="button"
                            accessibilityLabel={label}
                            style={{ alignItems: 'center', width: 64 }}
                        >
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: isSelected ? 2 : 1,
                                    borderColor: isSelected ? '#3B82F6' : '#E5E7EB',
                                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                                }}
                            >
                                <AppIcon
                                    name={icon}
                                    size={22}
                                    color={isSelected ? '#3B82F6' : '#374151'}
                                />
                            </View>
                            <Text
                                className="text-[10px] font-semibold text-gray-600 mt-1"
                                style={{ textAlign: 'center' }}
                                numberOfLines={1}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </ScrollView>
    );
}

/* ----- Bottom dock --------------------------------------------------------- */

interface SettleUpBottomDockProps {
    settlementDate: Date;
    locale: string;
    onOpenDatePicker: () => void;
    onRecord: () => void;
    recordDisabled: boolean;
    saveLabel: string;
    submitting: boolean;
}

function SettleUpBottomDock({
    settlementDate,
    locale,
    onOpenDatePicker,
    onRecord,
    recordDisabled,
    saveLabel,
    submitting,
}: SettleUpBottomDockProps) {
    return (
        <View
            className="bg-white/95 border-t border-border-soft"
            style={{
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 22,
            }}
        >
            <View className="items-center mb-3">
                <Pressable
                    onPress={onOpenDatePicker}
                    className="flex-row items-center bg-white border border-border-card rounded-full px-3 py-1"
                    style={{
                        shadowColor: '#000',
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        shadowOffset: { width: 0, height: 1 },
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={formatShortDate(settlementDate, locale)}
                    testID="settle-date-chip"
                >
                    <AppIcon name="calendar-outline" size={13} color="#4B5563" />
                    <Text className="text-[12px] font-semibold text-gray-500" style={{ marginHorizontal: 6 }}>
                        {formatShortDate(settlementDate, locale)}
                    </Text>
                    <AppIcon name="chevron-down" size={11} color="#6B7280" />
                </Pressable>
            </View>

            <View
                className="items-center"
                style={recordDisabled ? { opacity: 0.55 } : null}
            >
                <Button
                    title={saveLabel}
                    onPress={onRecord}
                    variant="secondary"
                    loading={submitting}
                    disabled={recordDisabled}
                    fullWidth={false}
                    testID="settle-record-button"
                />
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConsolidationDebtList — shown inside SettleUpSheet for consolidation flows
// ─────────────────────────────────────────────────────────────────────────────

interface ConsolidationDebtListProps {
    debts: PairwiseDebt[];
    memberMap: Record<string, GroupMemberLite>;
    currentUserId: string;
}

function ConsolidationDebtList({ debts, memberMap, currentUserId }: ConsolidationDebtListProps) {
    const { t } = useTranslation();
    return (
        <View className="mx-4 mt-4 mb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {t('consolidation.settlingDebtsLabel')}
            </Text>
            <View className="bg-gray-50 rounded-2xl overflow-hidden">
                {debts.map((debt, idx) => {
                    const payerName = debt.fromUserId === currentUserId
                        ? t('common.you')
                        : (memberMap[debt.fromUserId]?.displayName ?? t('common.unknown'));
                    const receiverName = debt.toUserId === currentUserId
                        ? t('common.you')
                        : (memberMap[debt.toUserId]?.displayName ?? t('common.unknown'));
                    return (
                        <View
                            key={`${debt.currency}-${debt.fromUserId}-${idx}`}
                            className={`flex-row items-center justify-between px-4 py-3 ${
                                idx < debts.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                        >
                            <Text
                                className="text-gray-600 text-sm flex-1 mr-3"
                                numberOfLines={1}
                                style={{ writingDirection: 'ltr', textAlign: 'left' }}
                            >
                                {payerName} → {receiverName}
                            </Text>
                            <Text className="text-gray-800 text-sm font-semibold">
                                {debt.currency} {debt.amount.toFixed(2)}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
