import React, { useCallback } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { useNotificationPreferences, useSaveNotificationPreferences } from '../../hooks/queries/useNotificationPreferences';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@cost-share/shared';
import { deviceTimezone } from '../../services/notificationPreferences.service';
import { NotificationsDisabledHint } from '../../components/settings/NotificationsDisabledHint';
import { usePushPermissionPrompt } from '../../hooks/usePushPermissionPrompt';

export function NotificationSettingsScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { data: prefs = DEFAULT_NOTIFICATION_PREFERENCES } = useNotificationPreferences();
    const save = useSaveNotificationPreferences();
    const { status: osStatus, promptSoftAsk } = usePushPermissionPrompt();

    const patch = useCallback(
        (partial: Partial<NotificationPreferences>) => {
            save.mutate({ ...prefs, ...partial, timezone: prefs.timezone || deviceTimezone() });
        },
        [prefs, save],
    );

    const masterOff = !prefs.pushEnabled;

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: insets.bottom }}>
            <View className="pt-4">
                {osStatus === 'denied' ? <NotificationsDisabledHint /> : null}

                <SettingsSection title={t('notifications.title')}>
                    <SettingsToggleRow
                        iconName="notifications-outline"
                        label={t('notifications.pushMaster')}
                        value={prefs.pushEnabled}
                        onValueChange={(v) => {
                            if (v && osStatus === 'undetermined') {
                                void promptSoftAsk();
                            }
                            patch({ pushEnabled: v });
                        }}
                        testID="pref-master"
                    />
                </SettingsSection>

                <SettingsSection title={t('notifications.categoriesTitle')}>
                    <SettingsToggleRow iconName="receipt-outline" label={t('notifications.categoryExpenses')}
                        value={prefs.expensesPush} disabled={masterOff} onValueChange={(v) => patch({ expensesPush: v })} />
                    <SettingsToggleRow iconName="cash-outline" label={t('notifications.categorySettlements')}
                        value={prefs.settlementsPush} disabled={masterOff} onValueChange={(v) => patch({ settlementsPush: v })} />
                    <SettingsToggleRow iconName="alarm-outline" label={t('notifications.categoryReminders')}
                        value={prefs.remindersPush} disabled={masterOff} onValueChange={(v) => patch({ remindersPush: v })} />
                    <SettingsToggleRow iconName="chatbubble-outline" label={t('notifications.categoryMessages')}
                        value={prefs.messagesPush} disabled={masterOff} onValueChange={(v) => patch({ messagesPush: v })} />
                    <SettingsToggleRow iconName="person-add-outline" label={t('notifications.categoryFriends')}
                        value={prefs.friendsPush} disabled={masterOff} onValueChange={(v) => patch({ friendsPush: v })} />
                    <SettingsToggleRow iconName="people-outline" label={t('notifications.categoryGroups')}
                        value={prefs.groupsPush} disabled={masterOff} onValueChange={(v) => patch({ groupsPush: v })} />
                </SettingsSection>

                <SettingsSection title={t('notifications.emailTitle')}>
                    <SettingsToggleRow
                        iconName="mail-outline"
                        label={t('notifications.emailMaster')}
                        value={prefs.emailEnabled}
                        onValueChange={(v) => patch({ emailEnabled: v, lifecycleEmailEnabled: v ? prefs.lifecycleEmailEnabled : false })}
                        testID="pref-email-master"
                    />
                    <SettingsToggleRow
                        iconName="paper-plane-outline"
                        label={t('notifications.lifecycleEmail')}
                        value={prefs.lifecycleEmailEnabled}
                        disabled={!prefs.emailEnabled}
                        onValueChange={(v) => patch({ lifecycleEmailEnabled: v })}
                        testID="pref-lifecycle-email"
                    />
                </SettingsSection>

                <SettingsSection title={t('notifications.quietHoursTitle')}>
                    <SettingsToggleRow
                        iconName="moon-outline"
                        label={t('notifications.quietHoursEnable')}
                        value={prefs.quietHoursEnabled}
                        disabled={masterOff}
                        onValueChange={(v) => patch({ quietHoursEnabled: v })}
                    />
                    <View className="px-4 py-3 border-t border-slate-100">
                        <Text className="text-gray-600 text-sm">
                            {t('notifications.quietHoursSummary', {
                                start: prefs.quietHoursStart,
                                end: prefs.quietHoursEnd,
                                tz: prefs.timezone || deviceTimezone(),
                            })}
                        </Text>
                        <Text className="text-gray-500 text-xs mt-2">
                            {t('notifications.frequencyCapHint', { count: prefs.dailyPushCap })}
                        </Text>
                    </View>
                </SettingsSection>
            </View>
        </ScrollView>
    );
}
