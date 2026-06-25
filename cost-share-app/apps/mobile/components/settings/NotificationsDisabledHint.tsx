import { Text } from '../AppText';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme';
import { openAppNotificationSettings } from '../../lib/notificationSettings';

// Footer shown under the Notifications row when OS notifications are off.
// The inline link jumps to the device notification settings so the user can re-enable them.
export function NotificationsDisabledHint() {
    const { t } = useTranslation();
    return (
        <Text className="text-xs text-gray-500">
            {t('notifications.systemDisabledHint')}{' '}
            <Text
                className="text-xs font-semibold"
                style={{ color: colors.primary }}
                testID="notifications-go-to-settings"
                onPress={() => { void openAppNotificationSettings(); }}
            >
                {t('notifications.goToSettings')}
            </Text>
        </Text>
    );
}
