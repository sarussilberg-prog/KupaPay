/**
 * MemberContributionRow — one row of the per-member list on the Balances
 * screen. Dense row inside a shared white "Members" card: small avatar,
 * display name (or "You"), and per-currency `paid` amounts on the right.
 * Tapping opens the MemberContributionDialog (handled by the parent).
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CurrencyAmount } from '@cost-share/shared';
import { Text } from '../AppText';
import { MemberAvatar } from '../MemberAvatar';
import { CurrencyAmountList } from './CurrencyAmountList';

interface MemberContributionRowProps {
    userId: string;
    name: string;
    avatarUrl?: string;
    amounts: CurrencyAmount[];
    isCurrentUser?: boolean;
    isLast?: boolean;
    onPress: () => void;
}

export function MemberContributionRow({
    userId,
    name,
    avatarUrl,
    amounts,
    isCurrentUser = false,
    isLast = false,
    onPress,
}: MemberContributionRowProps) {
    const { t } = useTranslation();
    const displayName = isCurrentUser ? t('settleUp.you') : name;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            className={`flex-row items-center px-4 py-3 ${
                isLast ? '' : 'border-b border-slate-100'
            }`}
            testID={`member-row-${userId}`}
        >
            <MemberAvatar name={name} avatarUrl={avatarUrl} size="xs" />
            <Text className="flex-1 ml-3 text-sm text-gray-900">
                {displayName}
            </Text>
            <View className="items-end">
                <CurrencyAmountList
                    amounts={amounts}
                    textClassName="text-sm font-semibold text-gray-900"
                />
            </View>
        </TouchableOpacity>
    );
}
