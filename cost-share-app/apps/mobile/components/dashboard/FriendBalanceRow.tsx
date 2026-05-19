import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FriendBalance } from '@cost-share/shared';
import { MemberAvatar } from '../MemberAvatar';

interface Props {
    friend: FriendBalance;
    onPress: (friend: FriendBalance) => void;
    testID?: string;
}

export function FriendBalanceRow({ friend, onPress, testID }: Props) {
    const { t } = useTranslation();
    const isSettled = Math.abs(friend.netBalance) < 0.01;
    const owesYou = friend.netBalance > 0;
    const amountText = isSettled
        ? t('dashboard.settled')
        : `${Math.abs(friend.netBalance).toFixed(2)} ${friend.currency}`;
    const amountClass = isSettled ? 'text-gray-400' : owesYou ? 'text-green-600' : 'text-red-600';

    return (
        <TouchableOpacity
            onPress={() => onPress(friend)}
            testID={testID}
            className="flex-row items-center bg-white rounded-2xl px-4 py-3 mx-4 mb-2 border border-gray-100"
        >
            <MemberAvatar name={friend.name} avatarUrl={friend.avatarUrl} size="sm" />
            <View className="flex-1 ms-3">
                <Text className="text-base font-medium text-gray-900">{friend.name}</Text>
                {!isSettled ? (
                    <Text className="text-xs text-gray-500 mt-0.5">
                        {owesYou ? t('dashboard.owesYou') : t('dashboard.youOweFriend')}
                    </Text>
                ) : null}
            </View>
            <Text className={`text-base font-semibold ${amountClass}`}>{amountText}</Text>
        </TouchableOpacity>
    );
}
