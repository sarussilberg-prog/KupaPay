/**
 * SettlementHistoryScreen
 * List of past settlements (and consolidation batches) in a group.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import { ConsolidationBatch, DisplaySettlement, GroupMemberLite, Settlement } from '@cost-share/shared';
import { useGroupUsersQuery } from '../../hooks/queries/useGroupUsersQuery';
import { useDisplaySettlementsQuery } from '../../hooks/queries/useConsolidationQueries';
import { useDeleteConsolidationBatchMutation } from '../../hooks/queries/useConsolidationQueries';
import { useDeleteSettlementMutation } from '../../hooks/queries/useSettlementQueries';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { ConsolidationBatchRow } from '../../components/ConsolidationBatchRow';
import { SettlementRow } from '../../components/SettlementRow';
import { FeedItemDetailSheet } from '../../components/FeedItemDetailSheet';
import { platformAlert } from '../../lib/platformAlert';
import { colors } from '../../theme';
import { getAvatarUrl, getDisplayName } from '../../lib/userDisplay';
import { useAppStore } from '../../store';

export function SettlementHistoryScreen() {
    const { t } = useTranslation();
    const route = useRoute<any>();
    const { groupId } = route.params;
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');

    const { data: allUsers = [] } = useGroupUsersQuery(groupId);
    const { data: displayItems = [], isLoading, refetch } = useDisplaySettlementsQuery(groupId);
    const [refreshing, setRefreshing] = useState(false);

    const memberMap = useMemo<Record<string, GroupMemberLite>>(() => {
        const map: Record<string, GroupMemberLite> = {};
        for (const u of allUsers) {
            map[u.id] = {
                userId: u.id,
                displayName: getDisplayName(u, t),
                avatarUrl: getAvatarUrl(u) ?? undefined,
                isActive: u.isActive,
            };
        }
        return map;
    }, [allUsers, t]);

    const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);
    const [detailBatch, setDetailBatch] = useState<{
        batch: ConsolidationBatch;
        settlements: Settlement[];
    } | null>(null);

    const deleteSettlementMutation = useDeleteSettlementMutation(groupId);
    const deleteBatchMutation = useDeleteConsolidationBatchMutation(groupId);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const getUserName = (userId: string): string =>
        getDisplayName(allUsers.find(u => u.id === userId) ?? null, t);

    const handleDeleteSettlement = useCallback(() => {
        if (!detailSettlement) return;
        const target = detailSettlement;
        platformAlert(t('settleUp.confirmDelete'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    void deleteSettlementMutation.mutateAsync(target.id).then(ok => {
                        if (ok) setDetailSettlement(null);
                    });
                },
            },
        ]);
    }, [detailSettlement, deleteSettlementMutation, t]);

    const handleDeleteBatch = useCallback(() => {
        if (!detailBatch) return;
        const target = detailBatch;
        platformAlert(t('consolidation.confirmDelete'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    void deleteBatchMutation.mutateAsync(target.batch.id).then(ok => {
                        if (ok) setDetailBatch(null);
                    });
                },
            },
        ]);
    }, [detailBatch, deleteBatchMutation, t]);

    const renderItem = useCallback(
        ({ item }: { item: DisplaySettlement }) => {
            if (item.kind === 'batch') {
                return (
                    <ConsolidationBatchRow
                        batch={item.batch}
                        settlements={item.settlements}
                        currentUserId={currentUserId}
                        memberMap={memberMap}
                        onPress={() => setDetailBatch({ batch: item.batch, settlements: item.settlements })}
                    />
                );
            }
            const s = item.settlement;
            const fromName = s.fromUserId === currentUserId
                ? t('settleUp.you')
                : (memberMap[s.fromUserId]?.displayName ?? getUserName(s.fromUserId));
            const toName = s.toUserId === currentUserId
                ? t('settleUp.you')
                : (memberMap[s.toUserId]?.displayName ?? getUserName(s.toUserId));
            return (
                <SettlementRow
                    settlement={s}
                    currentUserId={currentUserId}
                    fromName={fromName}
                    toName={toName}
                    onPress={() => setDetailSettlement(s)}
                />
            );
        },
        [currentUserId, memberMap, t],
    );

    if (isLoading && displayItems.length === 0) {
        return <LoadingIndicator />;
    }

    return (
        <View className="flex-1 bg-slate-50">
            <FlatList
                data={displayItems}
                keyExtractor={item =>
                    item.kind === 'batch' ? `batch-${item.batch.id}` : item.settlement.id
                }
                renderItem={renderItem}
                contentContainerClassName="p-4"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        iconName="swap-horizontal-outline"
                        title={t('balances.noSettlements')}
                        message={t('balances.noSettlementsMessage')}
                    />
                }
            />

            <FeedItemDetailSheet
                item={detailSettlement ? { kind: 'settlement', settlement: detailSettlement } : null}
                memberMap={memberMap}
                currentUserId={currentUserId}
                onClose={() => setDetailSettlement(null)}
                onEdit={() => {}}
                onDelete={handleDeleteSettlement}
            />

            <FeedItemDetailSheet
                item={detailBatch ? { kind: 'consolidation_batch', batch: detailBatch.batch, settlements: detailBatch.settlements } : null}
                memberMap={memberMap}
                currentUserId={currentUserId}
                onClose={() => setDetailBatch(null)}
                onEdit={() => {}}
                onDelete={handleDeleteBatch}
            />
        </View>
    );
}
