import { Text } from '../AppText';
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FriendBalanceSummary } from '@cost-share/shared';
import { MemberAvatar } from '../MemberAvatar';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { formatCurrencyAmount } from '../../lib/currencyDisplay';
import { useRtlLayout, rtlRowStyle, rtlTrailingAlign } from '../../hooks/useRtlLayout';
import { getDisplayNameForFriend, getAvatarUrlForFriend } from '../../lib/userDisplay';

interface Props {
    friend: FriendBalanceSummary;
    onPress: (friend: FriendBalanceSummary) => void;
    testID?: string;
    isLast?: boolean;
}

/**
 * Friend tile. Renders the largest absolute per-currency balance as the
 * headline. Additional non-zero currencies surface as a small "+N more"
 * indicator so the row stays compact; the breakdown sheet shows them in full.
 */
function FriendBalanceRowInner({ friend, onPress, testID, isLast = false }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    const sorted = [...friend.byCurrency]
        .filter(c => Math.abs(c.net) >= 0.01)
        .sort(
            (a, b) =>
                Math.abs(b.net) - Math.abs(a.net) ||
                a.currency.localeCompare(b.currency),
        );
    const primary = sorted[0];
    const extraCount = sorted.length - 1;

    const friendName = getDisplayNameForFriend(friend, t);
    const friendAvatar = getAvatarUrlForFriend(friend);

    const isSettled = !primary;
    const owesYou = primary ? primary.net > 0 : false;
    const amountText = primary
        ? formatCurrencyAmount(Math.abs(primary.net), primary.currency)
        : null;
    const amountClass = isSettled
        ? 'text-slate-400'
        : owesYou
          ? 'text-emerald-600'
          : 'text-red-600';
    const subtitle = isSettled
        ? null
        : owesYou
          ? t('dashboard.owesYou')
          : t('dashboard.youOweFriend');

    return (
        <TouchableOpacity
            onPress={() => onPress(friend)}
            testID={testID}
            style={rtlRowStyle(isRtl)}
            className={`items-center px-4 py-3.5 ${isLast ? '' : 'border-b border-slate-100'}`}
            accessibilityRole="button"
        >
            <MemberAvatar
                name={friendName}
                avatarUrl={friendAvatar}
                size="md"
                testID={`${testID}-avatar`}
            />

            <View style={{ flex: 1, marginHorizontal: 12, minWidth: 0 }}>
                <Text
                    className="text-base font-medium text-slate-900"
                    numberOfLines={1}
                >
                    {friendName}
                </Text>
            </View>

            <View style={{ alignItems: rtlTrailingAlign(isRtl), flexShrink: 0, marginHorizontal: 4 }}>
                {subtitle ? (
                    <Text className="text-xs text-slate-500 mt-0.5">{subtitle}</Text>
                ) : null}
                {extraCount > 0 ? (
                    <Text
                        className="text-[10px] text-slate-400 mt-0.5"
                        testID={`${testID}-extra-count`}
                    >
                        {`+${extraCount} ${t('dashboard.friendMoreCurrencies', { count: extraCount, defaultValue: 'more' })}`}
                    </Text>
                ) : null}
                <Text className={`text-sm font-semibold ${amountClass}`}>
                    {amountText ?? formatCurrencyAmount(0, '')}
                </Text>
            </View>

            <AppIcon
                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={colors.gray400}
            />
        </TouchableOpacity>
    );
}

export const FriendBalanceRow = React.memo(FriendBalanceRowInner);
