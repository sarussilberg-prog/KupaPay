import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useInviteLink } from '../hooks/useInviteLink';
import { colors } from '../theme';
import { IconLabel } from './ui/IconLabel';
import { ListRow } from './ui/ListRow';

interface Props {
    kind: 'friend' | 'group';
    mode: 'expanded' | 'compact';
    groupId?: string;
}

export function InviteLinkBlock({ kind, mode, groupId }: Props) {
    const { t } = useTranslation();
    const { isReady, share, rotate } = useInviteLink(groupId);

    const rotateKey = kind === 'friend' ? 'invite.friend.rotate' : 'invite.group.rotate';
    const shareKey = kind === 'friend' ? 'invite.friend.cta' : 'invite.group.title';

    if (!isReady) return null;

    return (
        <View className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <ListRow
                onPress={share}
                className="items-center px-4 py-3 min-h-0 bg-white"
                testID="invite-link-share"
            >
                <IconLabel
                    iconName="share-outline"
                    iconSize={20}
                    iconColor={colors.primary}
                    label={t(shareKey)}
                    labelClassName="text-sm font-semibold text-gray-800"
                />
            </ListRow>

            {mode === 'expanded' && (
                <ListRow
                    onPress={rotate}
                    className="items-center px-4 py-3 min-h-0 bg-white border-t border-slate-100"
                    testID="invite-link-rotate"
                >
                    <IconLabel
                        iconName="refresh-outline"
                        iconSize={20}
                        iconColor={colors.gray600}
                        label={t(rotateKey)}
                        labelClassName="text-sm font-medium text-gray-700"
                    />
                </ListRow>
            )}
        </View>
    );
}
