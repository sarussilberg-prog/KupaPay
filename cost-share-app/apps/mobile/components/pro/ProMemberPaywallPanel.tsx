import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { ProBadge } from './ProBadge';
import { Button } from '../Button';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { openSubscriptionManagementForUser } from '../../lib/openSubscriptionManagement';

type Props = Readonly<{
    onClose?: () => void;
}>;

/** Shown instead of purchase plans when the user already has Pro. */
export function ProMemberPaywallPanel({ onClose }: Props) {
    const { t } = useTranslation();
    const language = useAppLanguage();

    return (
        <View className="flex-1 px-5 pt-6 pb-8 justify-center" testID="paywall-already-pro">
            <View className="items-center mb-6">
                <ProBadge />
            </View>
            <Text className="text-center text-xl font-semibold text-gray-900 mb-2">
                {t('pro.paywall.alreadyProTitle')}
            </Text>
            <Text className="text-center text-gray-600 leading-6 mb-8">
                {t('pro.paywall.alreadyProBody')}
            </Text>
            <Button
                title={t('pro.settings.manageSubscription')}
                onPress={() => void openSubscriptionManagementForUser(language)}
                variant="primary"
                fullWidth
                testID="paywall-already-pro-manage"
            />
            {onClose ? (
                <Pressable onPress={onClose} className="py-4 items-center mt-2" testID="paywall-close">
                    <Text className="text-primary font-semibold">{t('common.close')}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}
