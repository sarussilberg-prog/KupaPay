/**
 * ExpenseListScreen
 * List of expenses for a group
 * Uses NativeWind styling only, full i18n support
 */

import React, { useCallback, useState, useMemo } from 'react';
import { View, RefreshControl } from 'react-native';
import { HotVirtualizedList } from '../../components/lists/HotVirtualizedList';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Expense } from '@cost-share/shared';
import { useGroupExpensesQuery } from '../../hooks/queries/useGroupExpensesQuery';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { ExpenseCard } from '../../components/ExpenseCard';
import { useNetworkStatus } from '../../lib/networkStatus';
import { colors } from '../../theme';
import { useRequiredRouteParams } from '../../hooks/useRequiredRouteParams';
import { RouteParamsFallback } from '../../components/RouteParamsFallback';

export function ExpenseListScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { isValid, required } = useRequiredRouteParams(['groupId'] as const);
    const groupId = required?.groupId ?? '';
    const expensesQuery = useGroupExpensesQuery(isValid ? groupId : '');
    const { online } = useNetworkStatus();
    const [refreshing, setRefreshing] = useState(false);

    const expenses = useMemo(
        () =>
            (expensesQuery.data ?? [])
                .filter((e) => !e.isDeleted)
                .sort(
                    (a, b) =>
                        new Date(b.expenseDate).getTime() -
                        new Date(a.expenseDate).getTime(),
                ),
        [expensesQuery.data],
    );

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: queryKeys.groupExpenses(groupId) });
        setRefreshing(false);
    }, [groupId]);

    const handleExpensePress = useCallback(
        (expenseId: string) => {
            navigation.navigate('ExpenseDetail', { expenseId, groupId });
        },
        [navigation, groupId],
    );

    const renderExpense = useCallback(
        ({ item }: { item: Expense }) => (
            <ExpenseCard expense={item} onPress={handleExpensePress} />
        ),
        [handleExpensePress],
    );

    if (!isValid) {
        return <RouteParamsFallback />;
    }

    if (expensesQuery.isLoading && expenses.length === 0) {
        return <LoadingIndicator />;
    }

    return (
        <View className="flex-1 bg-slate-50">
            <HotVirtualizedList
                testID="expense-list-virtualized"
                data={expenses}
                keyExtractor={(item) => item.id}
                renderItem={renderExpense}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    online ? (
                        <EmptyState
                            iconName="cash-outline"
                            title={t('expenses.noExpenses')}
                            message={t('expenses.noExpensesMessage')}
                        />
                    ) : (
                        // Offline with nothing cached: be honest, and point to the
                        // action that still works — adding an expense (it queues
                        // and syncs on reconnect).
                        <EmptyState
                            iconName="cloud-offline-outline"
                            title={t('common.offlineTitle')}
                            message={t('expenses.offlineMessage')}
                        />
                    )
                }
            />
        </View>
    );
}
