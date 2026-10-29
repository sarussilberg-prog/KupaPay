import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { ProUpsellButton } from '../pro/ProUpsellButton';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
import { CurrencyPicker } from '../CurrencyPicker';
import {
    fetchGroupSpendingByCategory,
    fetchGroupSpendingByMember,
    fetchGroupSpendingByWeek,
    type CategorySpendRow,
    type MemberSpendRow,
    type WeekSpendRow,
} from '../../services/spendingInsights.service';
import { captureProductEvent } from '../../lib/productAnalytics';
import { touchProTrialFeature } from '../../services/proTrialFeatureTouch.service';

type Tab = 'category' | 'member' | 'week';

interface SpendingInsightsSheetProps {
    visible: boolean;
    groupId: string;
    defaultCurrency: string;
    memberNames: Record<string, string>;
    unlocked: boolean;
    onClose: () => void;
    onUpgrade: () => void;
}

function maxTotal(rows: { total: number }[]): number {
    return rows.reduce((m, r) => (r.total > m ? r.total : m), 0);
}

function BarRow({ label, total, max }: { label: string; total: number; max: number }) {
    const widthPct = max > 0 ? Math.round((total / max) * 100) : 0;
    return (
        <View className="mb-3">
            <View className="flex-row justify-between mb-1">
                <Text className="text-gray-800 text-sm flex-1 mr-2" numberOfLines={1}>
                    {label}
                </Text>
                <Text className="text-gray-600 text-sm">{total.toFixed(2)}</Text>
            </View>
            <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <View className="h-full bg-primary rounded-full" style={{ width: `${widthPct}%` }} />
            </View>
        </View>
    );
}

export function SpendingInsightsSheet({
    visible,
    groupId,
    defaultCurrency,
    memberNames,
    unlocked,
    onClose,
    onUpgrade,
}: SpendingInsightsSheetProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>('category');
    const [currency, setCurrency] = useState(defaultCurrency);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<CategorySpendRow[]>([]);
    const [members, setMembers] = useState<MemberSpendRow[]>([]);
    const [weeks, setWeeks] = useState<WeekSpendRow[]>([]);

    useEffect(() => {
        if (!visible) return;
        setCurrency(defaultCurrency);
    }, [visible, defaultCurrency]);

    useEffect(() => {
        if (!visible || !unlocked) return;
        setLoading(true);
        void Promise.all([
            fetchGroupSpendingByCategory(groupId, currency),
            fetchGroupSpendingByMember(groupId, currency),
            fetchGroupSpendingByWeek(groupId, currency),
        ]).then(([c, m, w]) => {
            setCategories(c);
            setMembers(m);
            setWeeks(w);
            setLoading(false);
            void captureProductEvent('spending_insights_viewed', {
                group_id: groupId,
                currency,
                category_rows: c.length,
            });
            touchProTrialFeature({ spendingInsights: true });
        });
    }, [visible, unlocked, groupId, currency]);

    const categoryMax = useMemo(() => maxTotal(categories), [categories]);
    const memberMax = useMemo(() => maxTotal(members), [members]);
    const weekMax = useMemo(() => maxTotal(weeks), [weeks]);

    return (
        <>
            <BottomSheetShell
                visible={visible}
                onClose={onClose}
                label={t('pro.spendingInsights.sheetTitle')}
            >
                <View className="px-4 pb-6" testID="bottom-sheet-body">
                {!unlocked ? (
                    <>
                        <Text className="text-gray-600 text-sm mb-4">{t('pro.spendingInsights.lockedBody')}</Text>
                        <ProUpsellButton
                            groupId={groupId}
                            title={t('pro.spendingInsights.upgrade')}
                            onPress={onUpgrade}
                            testID="spending-insights-upgrade"
                        />
                    </>
                ) : (
                    <>
                        <Pressable
                            onPress={() => setPickerOpen(true)}
                            className="border border-gray-200 rounded-xl py-2 px-3 mb-3"
                        >
                            <Text className="text-gray-700 text-center">{currency}</Text>
                        </Pressable>
                        <View className="flex-row mb-3">
                            {(['category', 'member', 'week'] as const).map(key => (
                                <Pressable
                                    key={key}
                                    onPress={() => setTab(key)}
                                    className={`flex-1 py-2 items-center rounded-lg mx-0.5 ${tab === key ? 'bg-primary/10' : 'bg-gray-100'}`}
                                >
                                    <Text className={`text-xs font-medium ${tab === key ? 'text-primary' : 'text-gray-600'}`}>
                                        {t(`pro.spendingInsights.tab.${key}`)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        {loading ? (
                            <ActivityIndicator className="my-6" />
                        ) : (
                            <ScrollView style={{ maxHeight: 360 }}>
                                {tab === 'category' &&
                                    categories.map(row => (
                                        <BarRow
                                            key={row.category}
                                            label={
                                                row.category === 'uncategorized'
                                                    ? t('pro.spendingInsights.uncategorized')
                                                    : t(`expenses.categories.${row.category}`, {
                                                          defaultValue: row.category,
                                                      })
                                            }
                                            total={row.total}
                                            max={categoryMax}
                                        />
                                    ))}
                                {tab === 'member' &&
                                    members.map(row => (
                                        <BarRow
                                            key={row.memberUserId}
                                            label={memberNames[row.memberUserId] ?? row.memberUserId.slice(0, 8)}
                                            total={row.total}
                                            max={memberMax}
                                        />
                                    ))}
                                {tab === 'week' &&
                                    weeks.map(row => (
                                        <BarRow
                                            key={row.weekStart}
                                            label={row.weekStart}
                                            total={row.total}
                                            max={weekMax}
                                        />
                                    ))}
                                {!loading &&
                                    ((tab === 'category' && categories.length === 0) ||
                                        (tab === 'member' && members.length === 0) ||
                                        (tab === 'week' && weeks.length === 0)) && (
                                        <Text className="text-gray-500 text-sm text-center py-4">
                                            {t('pro.spendingInsights.empty')}
                                        </Text>
                                    )}
                            </ScrollView>
                        )}
                    </>
                )}
                </View>
            </BottomSheetShell>
            <CurrencyPicker
                visible={pickerOpen}
                value={currency}
                onChange={(c: string) => {
                    setCurrency(c);
                    setPickerOpen(false);
                }}
                onClose={() => setPickerOpen(false)}
            />
        </>
    );
}
