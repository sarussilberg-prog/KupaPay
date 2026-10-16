import React from 'react';
import { ScrollView, View, RefreshControl, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { useAdminMonetizationMetricsQuery } from '../../hooks/queries/useAdminMonetizationMetricsQuery';
import { AdminMonetizationMetricsError } from '../../services/admin.service';
import type { MonetizationFunnel } from '../../services/admin.service';

function pct(num: number, den: number): string {
    if (den === 0) return '—';
    return Math.round((num / den) * 100) + '%';
}

function MetricRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700">{label}</Text>
                {sub ? <Text className="text-xs text-gray-400 mt-0.5">{sub}</Text> : null}
            </View>
            <Text className="text-base font-semibold text-gray-900">{String(value)}</Text>
        </View>
    );
}

function FunnelCard({ funnel, title }: { funnel: MonetizationFunnel; title: string }) {
    return (
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</Text>
            <MetricRow label="Gate shown" value={funnel.ad_gate_shown} />
            <MetricRow
                label="Watch tapped"
                value={funnel.ad_gate_watch_tapped}
                sub={pct(funnel.ad_gate_watch_tapped, funnel.ad_gate_shown) + ' of shown'}
            />
            <MetricRow
                label="Watch completed"
                value={funnel.ad_gate_watch_completed}
                sub={pct(funnel.ad_gate_watch_completed, funnel.ad_gate_watch_tapped) + ' of tapped'}
            />
            <MetricRow
                label="Go Pro tapped"
                value={funnel.ad_gate_pro_tapped}
                sub={pct(funnel.ad_gate_pro_tapped, funnel.ad_gate_shown) + ' of shown'}
            />
            <MetricRow label="Reminders sent" value={funnel.remind_sent} />
        </View>
    );
}

function resolveLoadErrorMessage(error: unknown, t: (key: string) => string): { title: string; body: string; testID: string } {
    if (error instanceof AdminMonetizationMetricsError) {
        if (error.code === 'not_admin') {
            return {
                title: t('admin.metrics.notAdminTitle'),
                body: t('admin.metrics.notAdminBody'),
                testID: 'admin-monetization-not-admin',
            };
        }
        if (error.code === 'analytics_unavailable') {
            return {
                title: t('admin.metrics.analyticsUnavailableTitle'),
                body: t('admin.metrics.analyticsUnavailableBody'),
                testID: 'admin-monetization-unconfigured',
            };
        }
    }
    return {
        title: t('admin.metrics.loadErrorTitle'),
        body: t('admin.metrics.loadError'),
        testID: 'admin-monetization-error',
    };
}

export function AdminMonetizationScreen() {
    const { t } = useTranslation();
    const query = useAdminMonetizationMetricsQuery();

    if (query.isLoading) {
        return (
            <View className="py-8 items-center" testID="admin-monetization-loading">
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

    const { funnel, by_feature, by_platform, daily } = query.data;

    return (
        <ScrollView
            className="flex-1 bg-slate-50 px-4 pt-4"
            refreshControl={
                <RefreshControl
                    refreshing={query.isRefetching}
                    onRefresh={() => void query.refetch()}
                />
            }
            testID="admin-monetization-screen"
        >
            <FunnelCard funnel={funnel} title={t('admin.monetization.allTimeFunnel')} />

            {Object.entries(by_feature).map(([key, f]) => (
                <FunnelCard key={key} funnel={f} title={key} />
            ))}

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.monetization.byPlatform')}
                </Text>
                {Object.entries(by_platform).map(([p, cnt]) => (
                    <MetricRow key={p} label={p} value={cnt} />
                ))}
            </View>

            <View className="bg-white rounded-2xl p-4 mb-8 border border-gray-100">
                <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.monetization.last7Days')}
                </Text>
                {daily.map((d) => (
                    <MetricRow
                        key={d.date}
                        label={d.date}
                        value={d.ad_gate_watch_completed + ' completed · ' + d.remind_sent + ' reminders'}
                        sub={d.ad_gate_shown + ' shown'}
                    />
                ))}
                {daily.length === 0 && (
                    <Text className="text-gray-400 text-sm text-center py-4">
                        {t('admin.monetization.noData')}
                    </Text>
                )}
            </View>
        </ScrollView>
    );
}
