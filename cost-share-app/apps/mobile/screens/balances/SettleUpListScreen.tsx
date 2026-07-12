/**
 * SettleUpListScreen
 * Lists the simplified settle-up plan in a group (per currency) — the same
 * set of transfers that the Balances screen's simplified-debts section shows.
 * Rows where the current user is involved are shown directly; debts that
 * don't involve the current user are collapsed behind a toggle.
 */

import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    ConsolidationBatch,
    DisplaySettlement,
    GroupMemberLite,
    PairwiseDebt,
    Settlement,
} from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { AppIcon } from '../../components/AppIcon';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { SettleUpSheet, SettleUpFormValues } from '../../components/SettleUpSheet';
import { DebtRow } from '../../components/balances/DebtRow';
import { DebtPairGroup } from '../../components/balances/DebtPairGroup';
import { groupDebtsByPair, PairGroup } from '../../lib/groupDebtsByPair';
import { FeedItemDetailSheet } from '../../components/FeedItemDetailSheet';
import { CurrenciesMergedBadge } from '../../components/CurrenciesMergedBadge';
import { RemindFlowSheet } from '../../components/remind/RemindFlowSheet';
import { ConsolidateCurrencySheet, ConsolidatePair } from '../../components/ConsolidateCurrencySheet';
import { sendSettleReminder, shareSettleReminder } from '../../services/remind.service';
import { platformAlert } from '../../lib/platformAlert';
import {
    useCreateSettlementMutation,
    useDeleteSettlementMutation,
    useGroupSettlementsQuery,
    useUpdateSettlementMutation,
} from '../../hooks/queries/useSettlementQueries';
import {
    useDisplaySettlementsQuery,
    useDeleteConsolidationBatchMutation,
    useCreateConsolidationBatchMutation,
} from '../../hooks/queries/useConsolidationQueries';
import { ConsolidationSettleData } from '../../components/ConsolidateCurrencySheet';
import { useSimplifiedDebts } from '../../hooks/useSimplifiedDebts';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { useGroupUsersQuery } from '../../hooks/queries/useGroupUsersQuery';
import { useGroupsQuery } from '../../hooks/queries/useGroupsQuery';
import { useGroupSettlementsRealtime } from '../../hooks/useGroupSettlementsRealtime';
import { useAppStore } from '../../store';
import { colors } from '../../theme';
import { getAvatarUrl, getAvatarUrlForMember, getDisplayName } from '../../lib/userDisplay';
import { joinAmounts, owedDebts } from '../../lib/reminderMessage';

interface SortedDebts {
    youInvolved: PairwiseDebt[];
    others: PairwiseDebt[];
}

function sortDebts(debts: PairwiseDebt[], currentUserId: string): SortedDebts {
    const youInvolved: PairwiseDebt[] = [];
    const others: PairwiseDebt[] = [];
    for (const d of debts) {
        if (d.fromUserId === currentUserId || d.toUserId === currentUserId) {
            youInvolved.push(d);
        } else {
            others.push(d);
        }
    }
    const cmp = (a: PairwiseDebt, b: PairwiseDebt) => b.amount - a.amount;
    youInvolved.sort(cmp);
    others.sort(cmp);
    return { youInvolved, others };
}

export function SettleUpListScreen() {
    const { t } = useTranslation();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { groupId } = route.params;
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const groupsQuery = useGroupsQuery();
    const group = groupsQuery.data?.find(g => g.id === groupId);
    const groupName = group?.name;
    const groupDefaultCurrency = group?.defaultCurrency ?? 'USD';

    useLayoutEffect(() => {
        if (groupName) {
            navigation.setOptions({ title: groupName });
        }
    }, [navigation, groupName]);

    const { data: members = [] } = useGroupUsersQuery(groupId);
    const memberLites = useMemo<GroupMemberLite[]>(
        () =>
            members.map(m => ({
                userId: m.id,
                displayName: getDisplayName(m, t),
                avatarUrl: getAvatarUrl(m) ?? undefined,
                isActive: m.isActive,
            })),
        [members, t],
    );

    const { data: simplified, isLoading } = useSimplifiedDebts();
    const isFetching = isLoading;
    const isRefetching = false;
    const debts = useMemo<PairwiseDebt[]>(() => {
        const perCurrency = simplified?.byGroupCurrency.get(groupId);
        if (!perCurrency) return [];
        const out: PairwiseDebt[] = [];
        perCurrency.forEach((transfers, currency) => {
            transfers.forEach(t =>
                out.push({
                    fromUserId: t.fromUserId,
                    toUserId: t.toUserId,
                    currency,
                    amount: t.amount,
                }),
            );
        });
        return out;
    }, [simplified, groupId]);

    const refetch = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts });
    }, []);

    const { data: settlements = [], refetch: refetchSettlements } =
        useGroupSettlementsQuery(groupId);
    const { data: displaySettlements = [] } = useDisplaySettlementsQuery(groupId);

    const createMutation = useCreateSettlementMutation(groupId);
    const updateSettlementMutation = useUpdateSettlementMutation(groupId);
    const deleteSettlementMutation = useDeleteSettlementMutation(groupId);
    const deleteBatchMutation = useDeleteConsolidationBatchMutation(groupId);
    const createBatchMutation = useCreateConsolidationBatchMutation(groupId);

    useGroupSettlementsRealtime(groupId);

    const [activeDebt, setActiveDebt] = useState<PairwiseDebt | null>(null);
    const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);
    const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
    const [othersExpanded, setOthersExpanded] = useState(false);
    const [recordingPayment, setRecordingPayment] = useState(false);

    const [remindTargetDebt, setRemindTargetDebt] = useState<{
        fromUserId: string;
        toUserId: string;
        currency: string;
        amount: number;
        groupId: string;
    } | null>(null);
    const [remindLoading, setRemindLoading] = useState(false);

    const [convertPair, setConvertPair] = useState<ConsolidatePair | null>(null);
    const [consolidationSettle, setConsolidationSettle] = useState<ConsolidationSettleData | null>(null);
    const [detailBatch, setDetailBatch] = useState<{
        batch: ConsolidationBatch;
        settlements: Settlement[];
    } | null>(null);

    const memberMap = useMemo<Record<string, GroupMemberLite>>(() => {
        const map: Record<string, GroupMemberLite> = {};
        for (const m of memberLites) {
            map[m.userId] = m;
        }
        return map;
    }, [memberLites]);

    const sortedDisplaySettlements = useMemo(
        () =>
            [...displaySettlements].sort((a, b) => {
                const ta =
                    a.kind === 'batch'
                        ? a.batch.createdAt.getTime()
                        : a.settlement.createdAt.getTime();
                const tb =
                    b.kind === 'batch'
                        ? b.batch.createdAt.getTime()
                        : b.settlement.createdAt.getTime();
                return tb - ta;
            }),
        [displaySettlements],
    );

    const { youInvolved, others } = useMemo(
        () => sortDebts(debts, currentUserId),
        [debts, currentUserId],
    );

    const involvedGroups = useMemo(() => groupDebtsByPair(youInvolved), [youInvolved]);
    const othersGroups = useMemo(() => groupDebtsByPair(others), [others]);

    /** All debts grouped by counterpart — used to build ConsolidatePair. */
    const debtsByCounterpart = useMemo<Map<string, ConsolidatePair>>(() => {
        const map = new Map<string, ConsolidatePair>();
        for (const debt of debts) {
            if (
                debt.fromUserId !== currentUserId &&
                debt.toUserId !== currentUserId
            )
                continue;
            const counterpartId =
                debt.fromUserId === currentUserId
                    ? debt.toUserId
                    : debt.fromUserId;
            const existing = map.get(counterpartId);
            if (existing) {
                existing.debts.push(debt);
            } else {
                map.set(counterpartId, {
                    fromUserId: debt.fromUserId,
                    toUserId: debt.toUserId,
                    debts: [debt],
                });
            }
        }
        return map;
    }, [debts, currentUserId]);

    const displayName = useCallback(
        (userId: string): string => {
            if (userId === currentUserId) return t('settleUp.you');
            const m = memberLites.find(x => x.userId === userId);
            return m?.displayName ?? t('common.unknown');
        },
        [memberLites, currentUserId, t],
    );

    const memberAvatarFor = useCallback(
        (userId: string): string | undefined =>
            getAvatarUrlForMember(memberLites.find(x => x.userId === userId)),
        [memberLites],
    );

    const handleRowPress = useCallback((debt: PairwiseDebt) => {
        setActiveDebt(debt);
    }, []);

    const handleRemind = useCallback(
        (debt: PairwiseDebt) => {
            setRemindTargetDebt({
                fromUserId: debt.fromUserId,
                toUserId: debt.toUserId,
                currency: debt.currency,
                amount: debt.amount,
                groupId,
            });
        },
        [groupId],
    );

    const handleConvert = useCallback(
        (counterpartId: string) => {
            const pair = debtsByCounterpart.get(counterpartId);
            if (pair) setConvertPair(pair);
        },
        [debtsByCounterpart],
    );

    const buildDefaultMessage = useCallback(
        (debt: typeof remindTargetDebt) => {
            if (!debt) return '';
            const owed = owedDebts(debts, debt.fromUserId, debt.toUserId);
            const list =
                owed.length > 0
                    ? owed
                    : [
                          {
                              fromUserId: debt.fromUserId,
                              toUserId: debt.toUserId,
                              currency: debt.currency,
                              amount: debt.amount,
                          },
                      ];
            const amount = joinAmounts(list, t('remind.amountAnd'));
            return t('remind.defaultMessage', { amount, groupName: groupName ?? '' });
        },
        [t, groupName, debts],
    );

    /**
     * Render one DebtRow. `showRemind` / `showConvert` guard whether to
     * show each action button on this specific row.
     */
    const renderDebtRow = useCallback(
        (
            debt: PairwiseDebt,
            involved: boolean,
            showRemind = true,
            showConvert = false,
        ) => {
            const counterpartId =
                debt.fromUserId === currentUserId
                    ? debt.toUserId
                    : debt.fromUserId;
            return (
                <DebtRow
                    key={`${debt.fromUserId}:${debt.toUserId}:${debt.currency}`}
                    debt={debt}
                    involved={involved}
                    fromName={displayName(debt.fromUserId)}
                    toName={displayName(debt.toUserId)}
                    currentUserId={currentUserId}
                    fromAvatar={memberAvatarFor(debt.fromUserId)}
                    toAvatar={memberAvatarFor(debt.toUserId)}
                    onPress={() => handleRowPress(debt)}
                    onRemind={
                        showRemind && debt.fromUserId !== currentUserId
                            ? () => handleRemind(debt)
                            : undefined
                    }
                    onConvert={
                        showConvert
                            ? involved
                                ? () => handleConvert(counterpartId)
                                : () => setConvertPair({
                                    fromUserId: debt.fromUserId,
                                    toUserId: debt.toUserId,
                                    debts: [debt],
                                })
                            : undefined
                    }
                />
            );
        },
        [
            displayName,
            currentUserId,
            memberAvatarFor,
            handleRowPress,
            handleRemind,
            handleConvert,
            setConvertPair,
        ],
    );

    const remindTargetForGroup = useCallback(
        (group: PairGroup<PairwiseDebt>): PairwiseDebt | null => {
            const owesYou = group.debts.find(
                d => d.toUserId === currentUserId && d.fromUserId !== currentUserId,
            );
            if (owesYou) return owesYou;
            const involvesYou =
                group.userA === currentUserId || group.userB === currentUserId;
            return involvesYou ? null : group.debts[0];
        },
        [currentUserId],
    );

    /**
     * Render a PairGroup. The "convert" button appears once per counterpart
     * (tracked via seenConvertCounterparts in the caller).
     */
    const renderGroupOrRow = useCallback(
        (
            group: PairGroup<PairwiseDebt>,
            involved: boolean,
            seenConvertCounterparts: Set<string>,
        ) => {
            const counterpartId =
                group.userA === currentUserId ? group.userB : group.userA;
            const showConvert = !seenConvertCounterparts.has(counterpartId);
            if (showConvert) seenConvertCounterparts.add(counterpartId);

            if (group.debts.length === 1) {
                return renderDebtRow(group.debts[0], involved, true, showConvert);
            }
            const remindTarget = remindTargetForGroup(group);
            const doConvert = showConvert
                ? involved
                    ? () => handleConvert(counterpartId)
                    : () => setConvertPair({ fromUserId: group.userA, toUserId: group.userB, debts: group.debts })
                : undefined;
            return (
                <DebtPairGroup
                    key={group.pairKey}
                    group={group}
                    involved={involved}
                    currentUserId={currentUserId}
                    nameFor={displayName}
                    avatarFor={memberAvatarFor}
                    renderDebt={debt => renderDebtRow(debt, involved, false, false)}
                    onRemind={remindTarget ? () => handleRemind(remindTarget) : undefined}
                    onConvert={doConvert}
                />
            );
        },
        [
            renderDebtRow,
            remindTargetForGroup,
            currentUserId,
            displayName,
            memberAvatarFor,
            handleRemind,
            handleConvert,
            setConvertPair,
        ],
    );

    const handleSubmit = useCallback(
        async (values: SettleUpFormValues) => {
            await createMutation.mutateAsync({
                groupId,
                fromUserId: values.fromUserId,
                toUserId: values.toUserId,
                amount: values.amount,
                currency: values.currency,
                paymentMethod: values.paymentMethod,
                settlementDate: values.settlementDate,
            });
            setActiveDebt(null);
        },
        [createMutation, groupId],
    );

    const handleSettlementRowPress = useCallback((s: Settlement) => {
        setDetailSettlement(s);
    }, []);

    const handleBatchRowPress = useCallback(
        (item: DisplaySettlement & { kind: 'batch' }) => {
            setDetailBatch({
                batch: item.batch,
                settlements: item.settlements,
            });
        },
        [],
    );

    const handleDetailEdit = useCallback(() => {
        if (!detailSettlement) return;
        const s = detailSettlement;
        setDetailSettlement(null);
        setEditingSettlement(s);
    }, [detailSettlement]);

    const handleDetailDeleteRequest = useCallback(() => {
        if (!detailSettlement) return;
        const target = detailSettlement;
        platformAlert(t('settleUp.confirmDelete'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        const deleted =
                            await deleteSettlementMutation.mutateAsync(target.id);
                        if (deleted) setDetailSettlement(null);
                    })();
                },
            },
        ]);
    }, [detailSettlement, deleteSettlementMutation, t]);

    const handleBatchDeleteRequest = useCallback(() => {
        if (!detailBatch) return;
        const target = detailBatch;
        platformAlert(t('consolidation.confirmDelete'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        const ok = await deleteBatchMutation.mutateAsync(
                            target.batch.id,
                        );
                        if (ok) setDetailBatch(null);
                    })();
                },
            },
        ]);
    }, [detailBatch, deleteBatchMutation, t]);

    const handleSettlementEditSubmit = useCallback(
        async (values: SettleUpFormValues) => {
            if (!editingSettlement) return;
            const updated = await updateSettlementMutation.mutateAsync({
                id: editingSettlement.id,
                dto: {
                    fromUserId: values.fromUserId,
                    toUserId: values.toUserId,
                    amount: values.amount,
                    currency: values.currency,
                },
            });
            if (updated) setEditingSettlement(null);
        },
        [editingSettlement, updateSettlementMutation],
    );

    if ((isLoading || isFetching) && debts.length === 0) {
        return <LoadingIndicator />;
    }

    // seenConvertCounterparts is rebuilt each render from useMemo groups —
    // we pass it as a mutable Set so renderGroupOrRow can track the first row per pair.
    const seenConvertInvolved = new Set<string>();
    const seenConvertOthers = new Set<string>();

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
            <FlatList
                data={involvedGroups}
                keyExtractor={item => item.pairKey}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                ListHeaderComponent={
                    involvedGroups.length > 0 ? (
                        <Text className="mb-3 px-1 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                            {t('settleUp.openDebts')}
                        </Text>
                    ) : null
                }
                renderItem={({ item }) =>
                    renderGroupOrRow(item, true, seenConvertInvolved)
                }
                ListEmptyComponent={
                    isFetching || others.length > 0 ? null : (
                        <EmptyState
                            iconName="checkmark-circle-outline"
                            title={t('settleUp.empty')}
                            message={t('balances.noDebts')}
                        />
                    )
                }
                ListFooterComponent={
                    <>
                        {others.length > 0 ? (
                            <View className={involvedGroups.length > 0 ? 'mt-2' : 'mt-4'}>
                                <TouchableOpacity
                                    onPress={() => setOthersExpanded(v => !v)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    className="flex-row items-center px-3 py-2.5 rounded-2xl bg-slate-100/70 border border-gray-200"
                                    testID="settle-others-toggle"
                                >
                                    <AppIcon
                                        name={othersExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={16}
                                        color={colors.gray500}
                                    />
                                    <Text className="ml-2 flex-1 text-[13px] font-medium text-gray-600">
                                        {t('settleUp.othersToggle', { count: others.length })}
                                    </Text>
                                </TouchableOpacity>
                                {othersExpanded && (
                                    <View className="mt-2">
                                        {othersGroups.map(group =>
                                            renderGroupOrRow(group, false, seenConvertOthers),
                                        )}
                                    </View>
                                )}
                            </View>
                        ) : null}
                        {memberLites.filter(m => m.isActive).length >= 2 ? (
                            <TouchableOpacity
                                onPress={() => setRecordingPayment(true)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                className="mt-3 flex-row items-center justify-center px-3 py-3 rounded-2xl bg-white border border-dashed border-primary-dark"
                                testID="settle-record-payment-cta"
                            >
                                <AppIcon
                                    name="add-circle-outline"
                                    size={18}
                                    color={colors.primaryDark}
                                />
                                <Text className="ml-2 text-[14px] font-semibold text-primary-dark">
                                    {t('settleUp.recordPaymentCta')}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                        {sortedDisplaySettlements.length > 0 ? (
                            <View className="mt-8 mb-4">
                                <View className="flex-row items-center mb-3 px-1">
                                    <View className="flex-1 h-px bg-gray-300" />
                                    <View className="flex-row items-center mx-3">
                                        <AppIcon
                                            name="time-outline"
                                            size={14}
                                            color={colors.gray500}
                                        />
                                        <Text className="ml-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                                            {t('balances.settlementHistory')}
                                        </Text>
                                    </View>
                                    <View className="flex-1 h-px bg-gray-300" />
                                </View>
                                <View className="rounded-2xl bg-slate-100/70 border border-gray-200 overflow-hidden">
                                    {sortedDisplaySettlements.map((item, idx) => {
                                        const isLast = idx === sortedDisplaySettlements.length - 1;
                                        if (item.kind === 'batch') {
                                            const fromId = item.batch.paidByUserId;
                                            const toId = item.batch.paidToUserId
                                                ?? (item.settlements.length > 0
                                                    ? (item.settlements[0].fromUserId === fromId
                                                        ? item.settlements[0].toUserId
                                                        : item.settlements[0].fromUserId)
                                                    : undefined);
                                            return (
                                                <BatchHistoryRow
                                                    key={item.batch.id}
                                                    batch={item.batch}
                                                    settlements={item.settlements}
                                                    fromName={displayName(fromId)}
                                                    toName={toId ? displayName(toId) : ''}
                                                    currentUserId={currentUserId}
                                                    fromAvatar={memberAvatarFor(fromId)}
                                                    toAvatar={toId ? memberAvatarFor(toId) : undefined}
                                                    isLast={isLast}
                                                    onPress={() => handleBatchRowPress(item)}
                                                />
                                            );
                                        }
                                        return (
                                            <SettlementHistoryRow
                                                key={item.settlement.id}
                                                settlement={item.settlement}
                                                fromName={displayName(item.settlement.fromUserId)}
                                                toName={displayName(item.settlement.toUserId)}
                                                currentUserId={currentUserId}
                                                fromAvatar={memberAvatarFor(
                                                    item.settlement.fromUserId,
                                                )}
                                                toAvatar={memberAvatarFor(item.settlement.toUserId)}
                                                isLast={isLast}
                                                onPress={() =>
                                                    handleSettlementRowPress(item.settlement)
                                                }
                                            />
                                        );
                                    })}
                                </View>
                            </View>
                        ) : null}
                    </>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => {
                            void refetch();
                            void refetchSettlements();
                        }}
                        tintColor={colors.primary}
                    />
                }
            />

            {activeDebt && currentUserId && (
                <SettleUpSheet
                    visible={Boolean(activeDebt)}
                    members={memberLites}
                    pairwiseDebts={debts}
                    currentUserId={currentUserId}
                    initial={{
                        fromUserId: activeDebt.fromUserId,
                        toUserId: activeDebt.toUserId,
                        currency: activeDebt.currency,
                        amount: activeDebt.amount,
                    }}
                    mode="create"
                    submitting={createMutation.isPending}
                    onSubmit={handleSubmit}
                    onClose={() => setActiveDebt(null)}
                    groupName={groupName}
                />
            )}

            <FeedItemDetailSheet
                item={
                    detailSettlement
                        ? { kind: 'settlement', settlement: detailSettlement }
                        : null
                }
                memberMap={memberMap}
                currentUserId={currentUserId}
                onClose={() => setDetailSettlement(null)}
                onEdit={handleDetailEdit}
                onDelete={handleDetailDeleteRequest}
            />

            {editingSettlement && currentUserId && (
                <SettleUpSheet
                    visible={Boolean(editingSettlement)}
                    members={memberLites}
                    pairwiseDebts={debts}
                    currentUserId={currentUserId}
                    initial={{
                        fromUserId: editingSettlement.fromUserId,
                        toUserId: editingSettlement.toUserId,
                        currency: editingSettlement.currency,
                        amount: editingSettlement.amount,
                        settlementDate: editingSettlement.settlementDate,
                        paymentMethod: editingSettlement.paymentMethod,
                    }}
                    mode="edit"
                    submitting={updateSettlementMutation.isPending}
                    onSubmit={handleSettlementEditSubmit}
                    onClose={() => setEditingSettlement(null)}
                    groupName={groupName}
                />
            )}

            {recordingPayment && currentUserId && (
                <SettleUpSheet
                    visible={recordingPayment}
                    members={memberLites}
                    pairwiseDebts={debts}
                    currentUserId={currentUserId}
                    initial={pickRecordPaymentInitial({
                        memberLites,
                        currentUserId,
                        defaultCurrency: groupDefaultCurrency,
                    })}
                    mode="create"
                    allowParticipantEdit
                    submitting={createMutation.isPending}
                    onSubmit={async values => {
                        await handleSubmit(values);
                        setRecordingPayment(false);
                    }}
                    onClose={() => setRecordingPayment(false)}
                    groupName={groupName}
                />
            )}

            <RemindFlowSheet
                visible={remindTargetDebt !== null}
                featureKey="remind_user"
                defaultMessage={buildDefaultMessage(remindTargetDebt)}
                sending={remindLoading}
                onSend={async (mode, message) => {
                    if (!remindTargetDebt) return;
                    setRemindLoading(true);
                    try {
                        if (mode === 'app') {
                            await sendSettleReminder({
                                groupId: remindTargetDebt.groupId,
                                toUserId: remindTargetDebt.fromUserId,
                                message,
                            });
                        } else {
                            await shareSettleReminder({
                                groupId: remindTargetDebt.groupId,
                                message,
                            });
                        }
                        setRemindTargetDebt(null);
                    } finally {
                        setRemindLoading(false);
                    }
                }}
                onClose={() => setRemindTargetDebt(null)}
            />

            <ConsolidateCurrencySheet
                visible={convertPair !== null}
                pair={convertPair}
                currentUserId={currentUserId}
                memberMap={memberMap}
                onClose={() => setConvertPair(null)}
                onReadyToSettle={data => {
                    setConvertPair(null);
                    setConsolidationSettle(data);
                }}
            />

            {consolidationSettle && (
                <SettleUpSheet
                    visible={consolidationSettle !== null}
                    members={memberLites}
                    pairwiseDebts={[]}
                    currentUserId={currentUserId}
                    initial={{
                        fromUserId: consolidationSettle.netPayerId,
                        toUserId: consolidationSettle.netReceiverId,
                        currency: consolidationSettle.targetCurrency,
                        amount: consolidationSettle.netAmount,
                    }}
                    mode="create"
                    submitting={createBatchMutation.isPending}
                    consolidationDebts={consolidationSettle.pair.debts}
                    consolidationMemberMap={memberMap}
                    onSubmit={async values => {
                        const data = consolidationSettle;
                        const ok = await createBatchMutation.mutateAsync({
                            groupId,
                            fromUserId: data.netPayerId,
                            toUserId: data.netReceiverId,
                            paymentCurrency: values.currency,
                            paymentAmount: values.amount,
                            settlementDate: values.settlementDate,
                            settlements: data.settlements,
                        });
                        if (ok) setConsolidationSettle(null);
                    }}
                    onClose={() => setConsolidationSettle(null)}
                    groupName={groupName}
                />
            )}

            <FeedItemDetailSheet
                item={detailBatch ? { kind: 'consolidation_batch', batch: detailBatch.batch, settlements: detailBatch.settlements } : null}
                memberMap={memberMap}
                currentUserId={currentUserId}
                onClose={() => setDetailBatch(null)}
                onEdit={() => {}}
                onDelete={handleBatchDeleteRequest}
            />
        </SafeAreaView>
    );
}

interface RecordPaymentInitialArgs {
    memberLites: GroupMemberLite[];
    currentUserId: string;
    defaultCurrency: string;
}

function pickRecordPaymentInitial({
    memberLites,
    currentUserId,
    defaultCurrency,
}: RecordPaymentInitialArgs) {
    const activeMembers = memberLites.filter(m => m.isActive);
    const selfIsActive = activeMembers.some(m => m.userId === currentUserId);
    const fromUserId = selfIsActive
        ? currentUserId
        : activeMembers[0]?.userId ?? '';
    const toUserId =
        activeMembers.find(m => m.userId !== fromUserId)?.userId ?? '';
    return {
        fromUserId,
        toUserId,
        currency: defaultCurrency,
        amount: 0,
    };
}

interface SettlementHistoryRowProps {
    settlement: Settlement;
    fromName: string;
    toName: string;
    currentUserId: string;
    fromAvatar?: string;
    toAvatar?: string;
    isLast: boolean;
    onPress: () => void;
}

function SettlementHistoryRow({
    settlement,
    fromName,
    toName,
    currentUserId,
    fromAvatar,
    toAvatar,
    isLast,
    onPress,
}: SettlementHistoryRowProps) {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language?.startsWith('he') ?? false;
    const locale = isRtl ? 'he-IL' : undefined;
    const dateText = new Date(settlement.settlementDate).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    const amountText = `${settlement.currency} ${settlement.amount.toFixed(2)}`;
    const settlementLabel =
        settlement.fromUserId === currentUserId
            ? t('activity.youPaid', { name: toName, amount: amountText })
            : settlement.toUserId === currentUserId
              ? t('activity.paidYou', { name: fromName, amount: amountText })
              : t('feed.settlement', { from: fromName, to: toName, amount: amountText });
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            className={`flex-row items-center px-3 py-2.5 bg-transparent ${
                isLast ? '' : 'border-b border-gray-200'
            }`}
            testID={`settle-history-${settlement.id}`}
        >
            <View className="mr-2">
                <AppIcon name="checkmark-circle" size={18} color={colors.success.DEFAULT} />
            </View>
            <MemberAvatar name={fromName} avatarUrl={fromAvatar} size="xs" />
            <View className="mx-1.5">
                <Text className="text-gray-400 text-xs">{isRtl ? '←' : '→'}</Text>
            </View>
            <MemberAvatar name={toName} avatarUrl={toAvatar} size="xs" />

            <View className="flex-1 ml-2.5">
                <Text className="text-[13px] text-gray-600" numberOfLines={1}>
                    {settlementLabel}
                </Text>
                <Text className="text-[10px] text-gray-400 mt-0.5">{dateText}</Text>
            </View>

            <Text className="text-[13px] font-semibold text-gray-500">{amountText}</Text>
        </TouchableOpacity>
    );
}

interface BatchHistoryRowProps {
    batch: ConsolidationBatch;
    settlements: Settlement[];
    fromName: string;
    toName: string;
    currentUserId: string;
    fromAvatar?: string;
    toAvatar?: string;
    isLast: boolean;
    onPress: () => void;
}

function BatchHistoryRow({
    batch,
    settlements,
    fromName,
    toName,
    currentUserId,
    fromAvatar,
    toAvatar,
    isLast,
    onPress,
}: BatchHistoryRowProps) {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language?.startsWith('he') ?? false;
    const locale = isRtl ? 'he-IL' : undefined;
    const dateText = new Date(batch.createdAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    const amountText = `${batch.paymentCurrency} ${batch.paymentAmount.toFixed(2)}`;
    const settlementLabel =
        batch.paidByUserId === currentUserId
            ? t('activity.youPaid', { name: toName, amount: amountText })
            : (batch.paidToUserId === currentUserId || (!batch.paidToUserId && settlements.some(s => s.toUserId === currentUserId)))
              ? t('activity.paidYou', { name: fromName, amount: amountText })
              : t('feed.settlement', { from: fromName, to: toName, amount: amountText });

    const currencyCount = new Set(settlements.map(s => s.currency)).size;
    const count = (batch.settlementCount && batch.settlementCount > 0)
        ? batch.settlementCount
        : (currencyCount > 0 ? currencyCount : settlements.length);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            className={`flex-row items-center px-3 py-2.5 bg-transparent ${
                isLast ? '' : 'border-b border-gray-200'
            }`}
            testID={`batch-history-${batch.id}`}
        >
            <View className="mr-2">
                <AppIcon name="checkmark-circle" size={18} color={colors.success.DEFAULT} />
            </View>
            <MemberAvatar name={fromName} avatarUrl={fromAvatar} size="xs" />
            <View className="mx-1.5">
                <Text className="text-gray-400 text-xs">{isRtl ? '←' : '→'}</Text>
            </View>
            <MemberAvatar name={toName} avatarUrl={toAvatar} size="xs" />

            <View className="flex-1 ml-2.5">
                <Text className="text-[13px] text-gray-600" numberOfLines={1}>
                    {settlementLabel}
                </Text>
                <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                    <Text className="text-[10px] text-gray-400">{dateText}</Text>
                    <CurrenciesMergedBadge count={count} darker />
                </View>
            </View>

            <Text className="text-[13px] font-semibold text-gray-500">{amountText}</Text>
        </TouchableOpacity>
    );
}
