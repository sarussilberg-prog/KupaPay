import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { AppIcon, type AppIconName } from '../../components/AppIcon';
import { colors } from '../../theme';
import { useSentryIssuesQuery } from '../../hooks/queries/useAdminSentryQueries';
import type {
    SentryEnvironment,
    SentryStatusFilter,
    SentryTimeRange,
    SentryIssueSummary,
} from '../../services/adminSentry.service';

function levelIcon(level: string): { name: AppIconName; color: string } {
    switch (level) {
        case 'fatal':
            return { name: 'skull-outline', color: '#7c1d1d' };
        case 'error':
            return { name: 'alert-circle', color: '#dc2626' };
        case 'warning':
            return { name: 'warning-outline', color: '#d97706' };
        case 'info':
            return { name: 'information-circle-outline', color: '#2563eb' };
        default:
            return { name: 'bug-outline', color: colors.gray500 };
    }
}

function formatRelative(iso: string, locale: string): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const m = Math.round(diff / 60_000);
    if (m < 1) return locale === 'he' ? 'כעת' : 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.round(h / 24);
    return `${d}d`;
}

interface FilterChipProps {
    label: string;
    active: boolean;
    onPress: () => void;
    testID?: string;
}

function FilterChip({ label, active, onPress, testID }: FilterChipProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            testID={testID}
            className={`px-3 py-1 mr-2 rounded-full ${active ? 'bg-primary' : 'bg-white border border-gray-200'}`}
        >
            <Text className={active ? 'text-white text-xs' : 'text-gray-700 text-xs'}>{label}</Text>
        </TouchableOpacity>
    );
}

export function AdminErrorsScreen() {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation<any>();
    const [environment, setEnvironment] = useState<SentryEnvironment>('dev');
    const [status, setStatus] = useState<SentryStatusFilter>('unresolved');
    const [timeRange, setTimeRange] = useState<SentryTimeRange>('24h');

    const query = useSentryIssuesQuery({ environment, status, timeRange });
    const issues: SentryIssueSummary[] = query.data ?? [];

    const onRefresh = useCallback(() => {
        void query.refetch();
    }, [query]);

    const renderRow = useCallback(
        ({ item }: { item: SentryIssueSummary }) => {
            const icon = levelIcon(item.level);
            return (
                <TouchableOpacity
                    testID={`admin-error-row-${item.id}`}
                    onPress={() =>
                        navigation.navigate('AdminErrorDetail', {
                            issueId: item.id,
                            title: item.shortId,
                        })
                    }
                    className="flex-row items-center bg-white px-4 py-3 mx-3 mb-2 rounded-xl"
                >
                    <AppIcon name={icon.name} size={22} color={icon.color} />
                    <View className="flex-1 ml-3">
                        <Text className="text-sm text-gray-900" numberOfLines={2}>
                            {item.title}
                        </Text>
                        {item.culprit ? (
                            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                                {item.culprit}
                            </Text>
                        ) : null}
                        <View className="flex-row mt-1">
                            <Text className="text-[11px] text-gray-500 mr-3">
                                {t('admin.errors.occurrences', { count: Number(item.count) })}
                            </Text>
                            <Text className="text-[11px] text-gray-500 mr-3">
                                {t('admin.errors.affectedUsers', { count: item.userCount })}
                            </Text>
                            <Text className="text-[11px] text-gray-500">
                                {t('admin.errors.lastSeen', {
                                    when: formatRelative(item.lastSeen, i18n.language),
                                })}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        },
        [navigation, t, i18n.language],
    );

    return (
        <View className="flex-1 bg-slate-50">
            <View className="bg-white px-4 py-3 border-b border-gray-100">
                <Text className="text-[11px] uppercase text-gray-500 mb-1">
                    {t('admin.errors.filters.environment')}
                </Text>
                <View className="flex-row mb-3">
                    <FilterChip
                        label={t('admin.errors.filters.envDev')}
                        active={environment === 'dev'}
                        onPress={() => setEnvironment('dev')}
                        testID="filter-env-dev"
                    />
                    <FilterChip
                        label={t('admin.errors.filters.envProd')}
                        active={environment === 'prod'}
                        onPress={() => setEnvironment('prod')}
                        testID="filter-env-prod"
                    />
                </View>
                <Text className="text-[11px] uppercase text-gray-500 mb-1">
                    {t('admin.errors.filters.status')}
                </Text>
                <View className="flex-row mb-3">
                    <FilterChip
                        label={t('admin.errors.filters.statusUnresolved')}
                        active={status === 'unresolved'}
                        onPress={() => setStatus('unresolved')}
                        testID="filter-status-unresolved"
                    />
                    <FilterChip
                        label={t('admin.errors.filters.statusAll')}
                        active={status === 'all'}
                        onPress={() => setStatus('all')}
                        testID="filter-status-all"
                    />
                </View>
                <Text className="text-[11px] uppercase text-gray-500 mb-1">
                    {t('admin.errors.filters.timeRange')}
                </Text>
                <View className="flex-row">
                    <FilterChip
                        label={t('admin.errors.filters.range24h')}
                        active={timeRange === '24h'}
                        onPress={() => setTimeRange('24h')}
                        testID="filter-range-24h"
                    />
                    <FilterChip
                        label={t('admin.errors.filters.range7d')}
                        active={timeRange === '7d'}
                        onPress={() => setTimeRange('7d')}
                        testID="filter-range-7d"
                    />
                    <FilterChip
                        label={t('admin.errors.filters.range30d')}
                        active={timeRange === '30d'}
                        onPress={() => setTimeRange('30d')}
                        testID="filter-range-30d"
                    />
                </View>
            </View>

            {query.isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="text-xs text-gray-500 mt-2">{t('admin.errors.loading')}</Text>
                </View>
            ) : query.isError ? (
                <View className="flex-1 items-center justify-center px-8">
                    <Text testID="admin-errors-failed" className="text-gray-500 text-center">
                        {t('admin.errors.failed')}
                    </Text>
                </View>
            ) : issues.length === 0 ? (
                <View className="flex-1 items-center justify-center px-8">
                    <Text testID="admin-errors-empty" className="text-gray-500 text-center">
                        {t('admin.errors.empty')}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={issues}
                    keyExtractor={(i) => i.id}
                    refreshControl={
                        <RefreshControl refreshing={query.isRefetching} onRefresh={onRefresh} />
                    }
                    renderItem={renderRow}
                    contentContainerStyle={{ paddingVertical: 12 }}
                />
            )}
        </View>
    );
}
