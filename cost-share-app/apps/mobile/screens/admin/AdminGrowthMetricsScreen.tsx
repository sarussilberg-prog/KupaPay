import React from 'react';
import {
    ScrollView,
    View,
    RefreshControl,
    ActivityIndicator,
    Linking,
    Pressable,
    Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAU_EPIC_TARGET, mauEpicProgressPct } from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { useAdminGrowthMetricsQuery } from '../../hooks/queries/useAdminGrowthMetricsQuery';
import { AdminGrowthMetricsError } from '../../services/admin.service';
import { getPostHogMauDashboardUrl } from '../../lib/posthogMauDashboardUrl';

function MetricRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-1 pe-3">
                <Text className="text-sm font-medium text-gray-700">{label}</Text>
                {sub ? <Text className="text-xs text-gray-400 mt-0.5">{sub}</Text> : null}
            </View>
            <Text className="text-base font-semibold text-gray-900">{String(value)}</Text>
        </View>
    );
}

function resolveLoadErrorMessage(error: unknown, t: (key: string) => string): { title: string; body: string; testID: string } {
    if (error instanceof AdminGrowthMetricsError) {
        if (error.code === 'not_admin') {
            return {
                title: t('admin.metrics.notAdminTitle'),
                body: t('admin.metrics.notAdminBody'),
                testID: 'admin-growth-not-admin',
            };
        }
        if (error.code === 'analytics_unavailable') {
            return {
                title: t('admin.metrics.analyticsUnavailableTitle'),
                body: t('admin.growth.analyticsUnavailableBody'),
                testID: 'admin-growth-unconfigured',
            };
        }
    }
    return {
        title: t('admin.metrics.loadErrorTitle'),
        body: t('admin.metrics.loadError'),
        testID: 'admin-growth-error',
    };
}

export function AdminGrowthMetricsScreen() {
    const { t } = useTranslation();
    const query = useAdminGrowthMetricsQuery();
    const posthogUrl = getPostHogMauDashboardUrl();

    if (query.isLoading) {
        return (
            <View className="py-8 items-center" testID="admin-growth-loading">
                <ActivityIndicator />
            </View>
        );
    }

    if (query.isError || !query.data) {
        const { title, body, testID } = resolveLoadErrorMessage(query.error, t);
        return (
            <ScrollView
                className="flex-1 bg-slate-50"
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 32 }}
                refreshControl={
                    <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
                }
            >
                <Text className="text-base font-semibold text-slate-700 text-center mb-2" testID={testID}>
                    {title}
                </Text>
                <Text className="text-sm text-slate-500 text-center">{body}</Text>
            </ScrollView>
        );
    }

    const { northStar, activeExpenseAuthors, northStarMonthlySeries, asOf } = query.data;
    const epicPct = mauEpicProgressPct(activeExpenseAuthors.mau, MAU_EPIC_TARGET);

    return (
        <ScrollView
            className="flex-1 bg-slate-50 px-4 pt-4"
            refreshControl={
                <RefreshControl
                    refreshing={query.isRefetching}
                    onRefresh={() => void query.refetch()}
                />
            }
            testID="admin-growth-screen"
        >
            <Text className="text-xs text-slate-400 mb-3 text-center" testID="admin-growth-as-of">
                {t('admin.growth.asOf', { when: asOf })}
            </Text>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.growth.northStarTitle')}
                </Text>
                <Text className="text-xs text-gray-500 mb-3">{t('admin.growth.northStarDefinition')}</Text>
                <MetricRow
                    label={t('admin.growth.northStarCurrent', { month: northStar.currentMonth })}
                    value={northStar.currentMonthCount}
                />
                <MetricRow
                    label={t('admin.growth.northStarPrevious', { month: northStar.previousMonth })}
                    value={northStar.previousMonthCount}
                />
            </View>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.growth.activeAuthorsTitle')}
                </Text>
                <Text className="text-xs text-gray-500 mb-3">{t('admin.growth.activeAuthorsNote')}</Text>
                <MetricRow label={t('admin.growth.dau')} value={activeExpenseAuthors.dau} />
                <MetricRow label={t('admin.growth.wau')} value={activeExpenseAuthors.wau} />
                <MetricRow
                    label={t('admin.growth.mau')}
                    value={activeExpenseAuthors.mau}
                    sub={t('admin.growth.mauEpicProgress', {
                        target: MAU_EPIC_TARGET,
                        percent: epicPct,
                    })}
                />
            </View>

            {northStarMonthlySeries.length > 0 ? (
                <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                    <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {t('admin.growth.seriesTitle')}
                    </Text>
                    {northStarMonthlySeries.map((row) => (
                        <MetricRow
                            key={row.month}
                            label={row.month}
                            value={row.northStarGroups}
                        />
                    ))}
                </View>
            ) : null}

            {posthogUrl ? (
                <Pressable
                    className="bg-indigo-600 rounded-2xl py-3 px-4 mb-8 items-center"
                    onPress={() => void Linking.openURL(posthogUrl)}
                    testID="admin-growth-posthog-link"
                >
                    <Text className="text-white font-semibold text-sm">{t('admin.growth.openPostHogDashboard')}</Text>
                </Pressable>
            ) : (
                <Text className="text-xs text-slate-400 text-center mb-8 px-2" testID="admin-growth-posthog-hint">
                    {t('admin.growth.postHogDashboardHint')}
                </Text>
            )}

            {Platform.OS === 'web' ? (
                <Text className="text-xs text-slate-400 text-center mb-8">{t('admin.growth.webOnlyNote')}</Text>
            ) : null}
        </ScrollView>
    );
}
