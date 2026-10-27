import React from 'react';
import { ScrollView, View, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '../../components/AppText';
import {
    AdminGrowthMetricsError,
    AdminMonetizationMetricsError,
    type AdminMonetizationMetricsFailure,
} from '../../services/admin.service';

type MetricRowProps = Readonly<{
    label: string;
    value: string | number;
    sub?: string;
}>;

export function AdminAnalyticsMetricRow({ label, value, sub }: MetricRowProps) {
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

type AdminAnalyticsLoadError = AdminMonetizationMetricsError | AdminGrowthMetricsError;

export function resolveAdminAnalyticsLoadError(
    error: unknown,
    t: (key: string) => string,
    options: { unconfiguredBodyKey: string; testIdPrefix: string },
): { title: string; body: string; testID: string } {
    const code: AdminMonetizationMetricsFailure | undefined =
        error instanceof AdminMonetizationMetricsError || error instanceof AdminGrowthMetricsError
            ? error.code
            : undefined;

    if (code === 'not_admin') {
        return {
            title: t('admin.metrics.notAdminTitle'),
            body: t('admin.metrics.notAdminBody'),
            testID: `${options.testIdPrefix}-not-admin`,
        };
    }
    if (code === 'analytics_unavailable') {
        return {
            title: t('admin.metrics.analyticsUnavailableTitle'),
            body: t(options.unconfiguredBodyKey),
            testID: `${options.testIdPrefix}-unconfigured`,
        };
    }
    return {
        title: t('admin.metrics.loadErrorTitle'),
        body: t('admin.metrics.loadError'),
        testID: `${options.testIdPrefix}-error`,
    };
}

export function AdminAnalyticsMetricsLoading({ testID }: Readonly<{ testID: string }>) {
    return (
        <View className="py-8 items-center" testID={testID}>
            <ActivityIndicator />
        </View>
    );
}

type ErrorScrollProps = Readonly<{
    title: string;
    body: string;
    testID: string;
    isRefetching: boolean;
    onRefresh: () => void;
}>;

export function AdminAnalyticsMetricsErrorScroll({
    title,
    body,
    testID,
    isRefetching,
    onRefresh,
}: ErrorScrollProps) {
    return (
        <ScrollView
            className="flex-1 bg-slate-50"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 32 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        >
            <Text className="text-base font-semibold text-slate-700 text-center mb-2" testID={testID}>
                {title}
            </Text>
            <Text className="text-sm text-slate-500 text-center">{body}</Text>
        </ScrollView>
    );
}
