import React, { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { GroupWithMembers } from '@cost-share/shared';
import { Text } from '../AppText';
import { colors } from '../../theme';
import { GroupFormSection } from '../groups/CreateGroupFormShell';
import { handleError } from '../../lib/handleError';
import { queryKeys } from '../../hooks/queries/keys';
import { setGroupPublicWebShare } from '../../services/invite.service';

type Props = {
    groupId: string;
    enabled: boolean;
    inviteUrl: string;
    onEnabledChange?: (enabled: boolean) => void;
};

export function GroupPublicWebShareSection({
    groupId,
    enabled: initialEnabled,
    inviteUrl,
    onEnabledChange,
}: Props) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [enabled, setEnabled] = useState(initialEnabled);
    const [busy, setBusy] = useState(false);

    const onToggle = useCallback(
        async (next: boolean) => {
            setBusy(true);
            try {
                const saved = await setGroupPublicWebShare(groupId, next);
                setEnabled(saved);
                onEnabledChange?.(saved);
                queryClient.setQueryData<GroupWithMembers[]>(queryKeys.groups, (prev) =>
                    (prev ?? []).map((g) =>
                        g.id === groupId ? { ...g, publicWebShareEnabled: saved } : g,
                    ),
                );
            } catch (err) {
                handleError(err, {
                    toast: { titleKey: 'common.error' },
                    tags: { service: 'invite', op: 'setPublicWebShare' },
                    extra: { groupId },
                });
            } finally {
                setBusy(false);
            }
        },
        [groupId, onEnabledChange, queryClient],
    );

    return (
        <GroupFormSection title={t('invite.publicWeb.title')}>
            <View className="flex-row items-center justify-between gap-3 py-1">
                <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">
                        {t('invite.publicWeb.toggleLabel')}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 leading-4">
                        {t('invite.publicWeb.toggleHint')}
                    </Text>
                    {enabled ? (
                        <Text className="text-xs text-primary mt-2" selectable>
                            {inviteUrl}
                        </Text>
                    ) : null}
                </View>
                <Switch
                    value={enabled}
                    onValueChange={(v) => void onToggle(v)}
                    disabled={busy}
                    testID="group-public-web-share-toggle"
                />
            </View>
            <Text className="text-xs text-gray-400 mt-2">{t('invite.publicWeb.privacyNote')}</Text>
        </GroupFormSection>
    );
}
