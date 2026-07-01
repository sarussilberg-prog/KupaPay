import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { useNotificationPreferences, useSaveNotificationPreferences } from '../../hooks/queries/useNotificationPreferences';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@cost-share/shared';

export function NotificationSettingsScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { data: prefs = DEFAULT_NOTIFICATION_PREFERENCES } = useNotificationPreferences();
    const save = useSaveNotificationPreferences();

    const patch = useCallback(
        (key: keyof NotificationPreferences, value: boolean) => {
            save.mutate({ ...prefs, [key]: value });
        },
        [prefs, save],
    );

    const masterOff = !prefs.pushEnabled;

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: insets.bottom }}>
            <View className="pt-4">
                <SettingsSection title={t('notifications.title')}>
                    <SettingsToggleRow
                        iconName="notifications-outline"
                        label={t('notifications.pushMaster')}
                        value={prefs.pushEnabled}
                        onValueChange={(v) => patch('pushEnabled', v)}
                        testID="pref-master"
                    />
                </SettingsSection>

                <SettingsSection title={t('notifications.categoriesTitle')}>
                    <SettingsToggleRow iconName="receipt-outline" label={t('notifications.categoryExpenses')}
                        value={prefs.expensesPush} disabled={masterOff} onValueChange={(v) => patch('expensesPush', v)} />
                    <SettingsToggleRow iconName="cash-outline" label={t('notifications.categorySettlements')}
                        value={prefs.settlementsPush} disabled={masterOff} onValueChange={(v) => patch('settlementsPush', v)} />
                    <SettingsToggleRow iconName="chatbubble-outline" label={t('notifications.categoryMessages')}
                        value={prefs.messagesPush} disabled={masterOff} onValueChange={(v) => patch('messagesPush', v)} />
                    <SettingsToggleRow iconName="person-add-outline" label={t('notifications.categoryFriends')}
                        value={prefs.friendsPush} disabled={masterOff} onValueChange={(v) => patch('friendsPush', v)} />
                    <SettingsToggleRow iconName="people-outline" label={t('notifications.categoryGroups')}
                        value={prefs.groupsPush} disabled={masterOff} onValueChange={(v) => patch('groupsPush', v)} />
                </SettingsSection>
            </View>
        </ScrollView>
    );
}
