import React, { useMemo } from 'react';
import { FlatList, ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { deriveSimplifiedDebts } from '@cost-share/shared';
import { ProPaywallContent } from '../components/pro/ProPaywallContent';
import { GroupCard } from '../components/GroupCard';
import { DebtRow } from '../components/balances/DebtRow';
import { Text } from '../components/AppText';
import { CombinedPayerSplitButton } from '../components/expenseV2/CombinedPayerSplitButton';
import { CurrencyPill } from '../components/expenseV2/CurrencyPill';
import { CAPTURE_USER_ID, captureGroups, captureSimplifiedInputs } from './ascCaptureSeed';
import type { AscCaptureScreen } from '../lib/ascCaptureParams';
import { SettingsScreen } from '../screens/profile/SettingsScreen';

export function AscCaptureGroupsScreen() {
    const simplified = useMemo(
        () => deriveSimplifiedDebts(captureSimplifiedInputs, CAPTURE_USER_ID),
        [],
    );
    return (
        <FlatList
            style={styles.flex}
            testID="asc-demo-screen-groups"
            data={captureGroups}
            keyExtractor={g => g.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
                <GroupCard
                    group={item}
                    onPress={() => {}}
                    rollup={simplified?.groupRollups.get(item.id)}
                    groupHasOpenDebts
                />
            )}
        />
    );
}

export function AscCaptureBalancesScreen() {
    const simplified = useMemo(
        () => deriveSimplifiedDebts(captureSimplifiedInputs, CAPTURE_USER_ID),
        [],
    );
    const debts = simplified?.byGroupCurrency.get('g-barcelona')?.get('EUR') ?? [];
    return (
        <ScrollView style={styles.flex} testID="asc-demo-screen-balances">
            <View className="px-4 pt-4">
                <Text className="text-2xl font-bold text-slate-900 mb-4">Balances</Text>
                {debts.slice(0, 3).map(d => (
                    <DebtRow
                        key={`${d.fromUserId}-${d.toUserId}`}
                        debt={d}
                        involved={d.fromUserId === CAPTURE_USER_ID || d.toUserId === CAPTURE_USER_ID}
                        fromName={d.fromUserId === CAPTURE_USER_ID ? 'You' : 'Dana'}
                        toName={d.toUserId === CAPTURE_USER_ID ? 'You' : 'Yoni'}
                        currentUserId={CAPTURE_USER_ID}
                        onPress={() => {}}
                    />
                ))}
            </View>
        </ScrollView>
    );
}

export function AscCaptureAddExpenseScreen() {
    const { t } = useTranslation();
    return (
        <ScrollView style={styles.flex} testID="asc-demo-screen-add-expense">
            <SafeAreaView edges={['top']} className="px-4 pt-2">
                <Text className="text-2xl font-bold text-slate-900 mb-2">
                    {t('expenses.addTitle', 'Add expense')}
                </Text>
                <View className="flex-row items-center gap-2 mb-4">
                    <CurrencyPill currency="ILS" onPress={() => {}} />
                    <Text className="text-4xl font-bold text-slate-900">480</Text>
                </View>
                <Text className="text-base text-slate-600 mb-6">Dinner · split equally · 4 people</Text>
                <CombinedPayerSplitButton
                    payer={{ id: CAPTURE_USER_ID, name: t('common.you', 'You') }}
                    splitMembers={[
                        { id: CAPTURE_USER_ID, name: 'You' },
                        { id: 'u-dana', name: 'Dana' },
                        { id: 'u-yoni', name: 'Yoni' },
                    ]}
                    splitModeLabel={t('expenses.splitEqually', 'Split equally')}
                    payerEyebrow={t('expenses.paidBy', 'Paid by')}
                    onPress={() => {}}
                />
                <View className="mt-8 rounded-2xl bg-blue-600 py-4">
                    <Text className="text-center text-lg font-semibold text-white">
                        {t('common.save', 'Save')}
                    </Text>
                </View>
            </SafeAreaView>
        </ScrollView>
    );
}

export function AscCaptureSimplifiedDebtsScreen() {
    const simplified = useMemo(
        () => deriveSimplifiedDebts(captureSimplifiedInputs, CAPTURE_USER_ID),
        [],
    );
    const debts = simplified?.byGroupCurrency.get('g-barcelona')?.get('EUR') ?? [];
    return (
        <View style={styles.flex} testID="asc-demo-screen-simplified-debts">
            <FlatList
                data={captureGroups.slice(0, 1)}
                keyExtractor={g => g.id}
                ListHeaderComponent={
                    <View className="px-4 pt-4 pb-2">
                        <Text className="text-lg font-semibold text-slate-800">Smart settle-up</Text>
                        <Text className="text-sm text-slate-500 mt-1">3 payments → 2 transfers</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <GroupCard
                        group={item}
                        onPress={() => {}}
                        rollup={simplified?.groupRollups.get(item.id)}
                    />
                )}
                ListFooterComponent={
                    <View className="px-2 pt-2">
                        {debts.map(d => (
                            <DebtRow
                                key={`${d.fromUserId}-${d.toUserId}`}
                                debt={d}
                                involved
                                fromName={nameFor(d.fromUserId)}
                                toName={nameFor(d.toUserId)}
                                currentUserId={CAPTURE_USER_ID}
                                onPress={() => {}}
                            />
                        ))}
                    </View>
                }
            />
        </View>
    );
}

function nameFor(userId: string): string {
    const m = captureGroups[0].members.find(x => x.userId === userId);
    if (userId === CAPTURE_USER_ID) return 'You';
    return m?.displayName ?? userId;
}

export function AscCaptureProCurrencyScreen() {
    const { t } = useTranslation();
    return (
        <ScrollView style={styles.flex} testID="asc-demo-screen-pro-currency" className="p-4">
            <View className="rounded-2xl bg-white border border-slate-200 p-5 mb-3">
                <Text className="text-xs font-semibold uppercase text-blue-600">{t('pro.badge', 'Pro')}</Text>
                <Text className="mt-2 text-xl font-bold text-slate-900">{t('pro.paywall.feature2')}</Text>
                <Text className="mt-2 text-sm text-slate-600">Barcelona Trip · EUR + USD + ILS</Text>
            </View>
            <View className="rounded-2xl bg-white border border-slate-200 p-5">
                <Text className="text-sm text-slate-500">{t('groups.balance', 'Balance')}</Text>
                <Text className="mt-1 text-3xl font-bold text-slate-900">₪1,842.50</Text>
                <View className="mt-4 gap-2">
                    <Text className="text-base text-slate-700">€120.00 → ₪472.10</Text>
                    <Text className="text-base text-slate-700">$45.00 → ₪168.40</Text>
                    <Text className="text-base text-slate-700">₪1,202.00</Text>
                </View>
            </View>
        </ScrollView>
    );
}

export function AscCaptureProPaywallScreen() {
    return (
        <View style={styles.flex} testID="asc-demo-screen-pro-paywall">
            <ProPaywallContent featureKey="store_capture" showTripPass groupId="g-barcelona" />
        </View>
    );
}

export function AscCaptureSettingsProScreen() {
    return (
        <View style={styles.flex} testID="asc-demo-screen-settings-pro">
            <SettingsScreen />
        </View>
    );
}

export function renderAscCaptureScreen(screen: AscCaptureScreen) {
    switch (screen) {
        case 'groups':
            return <AscCaptureGroupsScreen />;
        case 'balances':
            return <AscCaptureBalancesScreen />;
        case 'add-expense':
            return <AscCaptureAddExpenseScreen />;
        case 'simplified-debts':
            return <AscCaptureSimplifiedDebtsScreen />;
        case 'pro-currency':
            return <AscCaptureProCurrencyScreen />;
        case 'pro-paywall':
            return <AscCaptureProPaywallScreen />;
        case 'settings-pro':
            return <AscCaptureSettingsProScreen />;
        default:
            return <AscCaptureGroupsScreen />;
    }
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: '#f1f5f9' },
});
