/**
 * BalancesScreen
 *
 * Top-level layout (top → bottom):
 *   • GroupTotalsCard — total spent / unsettled / expense count.
 *   • Members card — one row per group member, paid per currency.
 *     Tapping a row opens MemberContributionDialog (unchanged).
 *   • SimplifiedDebtsSection — per-currency runs of simplifyDebts.
 *     Debts that don't involve the current user are collapsed behind
 *     a toggle (mirrors SettleUpListScreen).
 *
 * Multi-currency-aware throughout; amounts are never silently
 * collapsed across currencies.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    CurrencyAmount,
    DebtSummary,
    GroupMemberLite,
    PairwiseDebt,
    calculateGroupTotalUnsettled,
} from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { SettleUpSheet, SettleUpFormValues } from '../../components/SettleUpSheet';
import { GroupTotalsCard } from '../../components/balances/GroupTotalsCard';
import { MemberContributionRow } from '../../components/balances/MemberContributionRow';
import { MemberContributionDialog } from '../../components/balances/MemberContributionDialog';
import { SimplifiedDebtsSection } from '../../components/balances/SimplifiedDebtsSection';
import { useGroupUsersQuery } from '../../hooks/queries/useGroupUsersQuery';
import { useGroupsQuery } from '../../hooks/queries/useGroupsQuery';
import {
    useGroupContributionsQuery,
} from '../../hooks/queries/useGroupBalancesQueries';
import { useCreateSettlementMutation } from '../../hooks/queries/useSettlementQueries';
import { useSimplifiedDebts } from '../../hooks/useSimplifiedDebts';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { useAppStore } from '../../store';
import type { SimplifiedDebtsByCurrencyEntry } from '../../services/groups.service';
import { fetchProfilesByUserIds } from '../../services/groups.service';
import { colors } from '../../theme';
import {
    getAvatarUrl,
    getAvatarUrlForMember,
    getDisplayName,
    getDisplayNameForMember,
} from '../../lib/userDisplay';

interface SettleTarget {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
}

function sumPaidByCurrency(
    totals: { paid: CurrencyAmount[] }[],
): CurrencyAmount[] {
    const acc = new Map<string, number>();
    for (const t of totals) {
        for (const row of t.paid) {
            acc.set(row.currency, (acc.get(row.currency) ?? 0) + row.amount);
        }
    }
    return Array.from(acc.entries())
        .map(([currency, amount]) => ({
            currency,
            amount: Number(amount.toFixed(2)),
        }))
        .filter(row => row.amount >= 0.01);
}

export function BalancesScreen() {
    const { t } = useTranslation();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { groupId } = route.params;
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const groupsQuery = useGroupsQuery();
    const group = groupsQuery.data?.find(g => g.id === groupId);
    const groupName = group?.name;
    const defaultCurrency = group?.defaultCurrency ?? 'USD';

    useLayoutEffect(() => {
        if (groupName) {
            navigation.setOptions({ title: groupName });
        }
    }, [navigation, groupName]);

    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
    // Profiles of debt parties NOT in the active roster (members who left or
    // deleted their account). The active-member query filters them out, so we
    // fetch them on demand to label each debt row with real data — a deleted
    // account renders "Deleted user", an account that merely left renders its
    // real name. Ids we can't resolve (offline) stay out and fall back to the
    // neutral "former member" rather than a fabricated "deleted user".
    const [formerParties, setFormerParties] = useState<Record<string, GroupMemberLite>>({});

    const { data: allUsers = [] } = useGroupUsersQuery(groupId);
    const {
        data: contributions,
        isLoading: isLoadingContributions,
        isFetching: isFetchingContributions,
        refetch: refetchContributions,
    } = useGroupContributionsQuery(groupId);
    const { data: simplified, isLoading: isLoadingDebts } = useSimplifiedDebts();
    const isFetchingDebts = isLoadingDebts;
    const refetchDebts = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts });
    }, []);
    const simplifiedByCurrency = useMemo<SimplifiedDebtsByCurrencyEntry[]>(() => {
        const perCurrency = simplified?.byGroupCurrency.get(groupId);
        if (!perCurrency) return [];
        const out: SimplifiedDebtsByCurrencyEntry[] = [];
        perCurrency.forEach((transfers, currency) => {
            const debts = transfers.map(t => ({
                fromUserId: t.fromUserId,
                fromUserName: '',
                toUserId: t.toUserId,
                toUserName: '',
                amount: t.amount,
                currency,
            }));
            out.push({
                currency,
                result: {
                    debts,
                    transactionCount: debts.length,
                    algorithm: 'exact',
                },
            });
        });
        return out.sort((a, b) => a.currency.localeCompare(b.currency));
    }, [simplified, groupId]);
    const pairwiseDebts = useMemo<PairwiseDebt[]>(() => {
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
    const refetchPairwise = refetchDebts;
    const createMutation = useCreateSettlementMutation(groupId);

    const members: GroupMemberLite[] = useMemo(
        () =>
            allUsers.map(u => ({
                userId: u.id,
                displayName: getDisplayName(u, t),
                avatarUrl: getAvatarUrl(u) ?? undefined,
                isActive: u.isActive,
            })),
        [allUsers, t],
    );

    // Debt parties that aren't active members — fetch their profiles so the
    // row shows real data (deleted → "Deleted user", left → real name) instead
    // of guessing. Offline, the fetch no-ops and they fall back to neutral.
    useEffect(() => {
        const activeIds = new Set(members.map(m => m.userId));
        const missing = new Set<string>();
        for (const e of simplifiedByCurrency) {
            for (const d of e.result.debts) {
                for (const id of [d.fromUserId, d.toUserId]) {
                    if (id && id !== currentUserId && !activeIds.has(id) && !formerParties[id]) {
                        missing.add(id);
                    }
                }
            }
        }
        if (missing.size === 0) return;
        void fetchProfilesByUserIds([...missing]).then(extra => {
            if (Object.keys(extra).length > 0) {
                setFormerParties(prev => ({ ...prev, ...extra }));
            }
        });
    }, [simplifiedByCurrency, members, currentUserId, formerParties]);

    const avatarById: Record<string, string | undefined> = useMemo(() => {
        const map: Record<string, string | undefined> = {};
        for (const id in formerParties) map[id] = getAvatarUrlForMember(formerParties[id]);
        for (const m of members) map[m.userId] = m.avatarUrl;
        return map;
    }, [members, formerParties]);

    const nameById: Record<string, string> = useMemo(() => {
        const map: Record<string, string> = {};
        // Off-roster parties first; active members override on id collision.
        for (const id in formerParties) map[id] = getDisplayNameForMember(formerParties[id], t);
        for (const m of members) map[m.userId] = m.displayName;
        return map;
    }, [members, formerParties, t]);

    const sortedMembers = useMemo(() => {
        const sorted = [...members];
        sorted.sort((a, b) => {
            if (a.userId === currentUserId) return -1;
            if (b.userId === currentUserId) return 1;
            return a.displayName.localeCompare(b.displayName);
        });
        return sorted;
    }, [members, currentUserId]);

    const totalsByUser = useMemo(() => {
        const map = new Map<string, { paid: CurrencyAmount[]; owed: CurrencyAmount[] }>();
        for (const row of contributions?.totals ?? []) {
            map.set(row.userId, { paid: row.paid, owed: row.owed });
        }
        return map;
    }, [contributions]);

    const totalSpent: CurrencyAmount[] = useMemo(
        () => sumPaidByCurrency(contributions?.totals ?? []),
        [contributions],
    );

    const unsettledTotal: CurrencyAmount[] = useMemo(() => {
        const flat: PairwiseDebt[] =
            simplifiedByCurrency?.flatMap(e =>
                e.result.debts.map(d => ({
                    fromUserId: d.fromUserId,
                    toUserId: d.toUserId,
                    currency: d.currency,
                    amount: d.amount,
                })),
            ) ?? [];
        return calculateGroupTotalUnsettled(flat);
    }, [simplifiedByCurrency]);

    const expenseCount = contributions?.expenseCount ?? 0;

    const paidForUser = useCallback(
        (userId: string): CurrencyAmount[] => {
            return totalsByUser.get(userId)?.paid ?? [];
        },
        [totalsByUser],
    );

    const handleMemberPress = useCallback((userId: string) => {
        setSelectedMemberId(userId);
    }, []);

    const handleSettle = useCallback((debt: DebtSummary) => {
        setSettleTarget({
            fromUserId: debt.fromUserId,
            toUserId: debt.toUserId,
            currency: debt.currency,
            amount: debt.amount,
        });
    }, []);

    const handleSubmitSettlement = useCallback(
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
            setSettleTarget(null);
        },
        [createMutation, groupId],
    );

    const handleRefresh = useCallback(async () => {
        await Promise.all([
            refetchContributions(),
            refetchDebts(),
            refetchPairwise(),
        ]);
    }, [refetchContributions, refetchDebts, refetchPairwise]);

    const selectedMember =
        selectedMemberId != null
            ? members.find(m => m.userId === selectedMemberId) ?? null
            : null;

    const dialogSelfTotals: CurrencyAmount[] = useMemo(() => {
        if (!selectedMemberId) return [];
        return paidForUser(selectedMemberId);
    }, [selectedMemberId, paidForUser]);

    const pairwiseDebtsForSettle: PairwiseDebt[] = useMemo(() => {
        if (!settleTarget) return pairwiseDebts;
        const seed: PairwiseDebt = {
            fromUserId: settleTarget.fromUserId,
            toUserId: settleTarget.toUserId,
            currency: settleTarget.currency,
            amount: settleTarget.amount,
        };
        const exists = pairwiseDebts.some(
            d =>
                d.fromUserId === seed.fromUserId &&
                d.toUserId === seed.toUserId &&
                d.currency === seed.currency,
        );
        return exists ? pairwiseDebts : [seed, ...pairwiseDebts];
    }, [pairwiseDebts, settleTarget]);

    if (
        (isLoadingContributions && !contributions) ||
        (isLoadingDebts && !simplifiedByCurrency)
    ) {
        return <LoadingIndicator />;
    }

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={isFetchingContributions || isFetchingDebts}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                <View className="px-4 pt-4">
                    <GroupTotalsCard
                        totalSpent={totalSpent}
                        unsettled={unsettledTotal}
                        expenseCount={expenseCount}
                        defaultCurrency={defaultCurrency}
                    />
                </View>

                <View className="px-4 pt-4">
                    <Text className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                        {t('balances.membersSectionLabel')}
                    </Text>
                    <View className="bg-white rounded-xl overflow-hidden">
                        {sortedMembers.map((member, idx) => (
                            <MemberContributionRow
                                key={member.userId}
                                userId={member.userId}
                                name={member.displayName}
                                avatarUrl={member.avatarUrl}
                                amounts={paidForUser(member.userId)}
                                isCurrentUser={member.userId === currentUserId}
                                isLast={idx === sortedMembers.length - 1}
                                onPress={() => handleMemberPress(member.userId)}
                            />
                        ))}
                    </View>
                </View>

                <View className="px-4 pt-4 pb-8">
                    <Text className="text-lg font-semibold text-gray-900 mb-1">
                        {t('balances.simplifiedDebts')}
                    </Text>
                    <SimplifiedDebtsSection
                        balanceUnknown={simplified === undefined}
                        entries={simplifiedByCurrency ?? []}
                        avatarById={avatarById}
                        nameById={nameById}
                        currentUserId={currentUserId}
                        onSettle={handleSettle}
                    />
                </View>
            </ScrollView>

            {/* Toggle was removed; the breakdown always shows what each member paid. */}
            <MemberContributionDialog
                open={selectedMember !== null}
                member={selectedMember}
                allMembers={sortedMembers}
                matrix={contributions?.matrix ?? []}
                selfTotals={dialogSelfTotals}
                mode="paid"
                currentUserId={currentUserId}
                onClose={() => setSelectedMemberId(null)}
            />

            {settleTarget && currentUserId && (
                <SettleUpSheet
                    visible={Boolean(settleTarget)}
                    members={members}
                    pairwiseDebts={pairwiseDebtsForSettle}
                    currentUserId={currentUserId}
                    initial={settleTarget}
                    mode="create"
                    submitting={createMutation.isPending}
                    onSubmit={handleSubmitSettlement}
                    onClose={() => setSettleTarget(null)}
                    groupName={groupName}
                />
            )}
        </View>
    );
}
