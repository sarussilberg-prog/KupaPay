import React from 'react';
import {
    ScrollView,
    View,
    RefreshControl,
    Linking,
    Pressable,
    Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAU_EPIC_TARGET, mauEpicProgressPct } from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { useAdminGrowthMetricsQuery } from '../../hooks/queries/useAdminGrowthMetricsQuery';
import { getPostHogMauDashboardUrl } from '../../lib/posthogMauDashboardUrl';
import {
    AdminAnalyticsMetricRow,
    AdminAnalyticsMetricsErrorScroll,
    AdminAnalyticsMetricsLoading,
    resolveAdminAnalyticsLoadError,
} from './adminAnalyticsMetricsUi';

export function AdminGrowthMetricsScreen() {
    const { t } = useTranslation();
    const query = useAdminGrowthMetricsQuery();
    const posthogUrl = getPostHogMauDashboardUrl();

    if (query.isLoading) {
        return <AdminAnalyticsMetricsLoading testID="admin-growth-loading" />;
    }

    if (query.isError || !query.data) {
        const { title, body, testID } = resolveAdminAnalyticsLoadError(query.error, t, {
            unconfiguredBodyKey: 'admin.growth.analyticsUnavailableBody',
            testIdPrefix: 'admin-growth',
        });
        return (
            <AdminAnalyticsMetricsErrorScroll
                title={title}
                body={body}
                testID={testID}
                isRefetching={query.isRefetching}
                onRefresh={() => void query.refetch()}
            />
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
                <AdminAnalyticsMetricRow
                    label={t('admin.growth.northStarCurrent', { month: northStar.currentMonth })}
                    value={northStar.currentMonthCount}
                />
                <AdminAnalyticsMetricRow
                    label={t('admin.growth.northStarPrevious', { month: northStar.previousMonth })}
                    value={northStar.previousMonthCount}
                />
            </View>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.growth.activeAuthorsTitle')}
                </Text>
                <Text className="text-xs text-gray-500 mb-3">{t('admin.growth.activeAuthorsNote')}</Text>
                <AdminAnalyticsMetricRow label={t('admin.growth.dau')} value={activeExpenseAuthors.dau} />
                <AdminAnalyticsMetricRow label={t('admin.growth.wau')} value={activeExpenseAuthors.wau} />
                <AdminAnalyticsMetricRow
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
                        <AdminAnalyticsMetricRow
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
