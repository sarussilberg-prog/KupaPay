import React, { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { GroupWithMembers } from '@cost-share/shared';
import { Text } from '../AppText';
import { GroupFormSection } from '../groups/CreateGroupFormShell';
import { handleError } from '../../lib/handleError';
import { queryKeys } from '../../hooks/queries/keys';
import { setGroupPublicBalanceSharing } from '../../services/invite.service';

type Props = {
    groupId: string;
    enabled: boolean;
    balanceUrl: string;
    onEnabledChange?: (enabled: boolean) => void;
};

export function GroupPublicBalanceShareSection({
    groupId,
    enabled: initialEnabled,
    balanceUrl,
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
                const saved = await setGroupPublicBalanceSharing(groupId, next);
                setEnabled(saved);
                onEnabledChange?.(saved);
                queryClient.setQueryData<GroupWithMembers[]>(queryKeys.groups, (prev) =>
                    (prev ?? []).map((g) =>
                        g.id === groupId ? { ...g, publicBalanceSharingEnabled: saved } : g,
                    ),
                );
            } catch (err) {
                handleError(err, {
                    toast: { titleKey: 'common.error' },
                    tags: { service: 'invite', op: 'setPublicBalanceSharing' },
                    extra: { groupId },
                });
            } finally {
                setBusy(false);
            }
        },
        [groupId, onEnabledChange, queryClient],
    );

    return (
        <GroupFormSection title={t('invite.publicBalance.title')}>
            <View className="flex-row items-center justify-between gap-3 py-1">
                <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">
                        {t('invite.publicBalance.toggleLabel')}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 leading-4">
                        {t('invite.publicBalance.toggleHint')}
                    </Text>
                    {enabled ? (
                        <Text className="text-xs text-primary mt-2" selectable>
                            {balanceUrl}
                        </Text>
                    ) : null}
                </View>
                <Switch
                    value={enabled}
                    onValueChange={(v) => void onToggle(v)}
                    disabled={busy}
                    testID="group-public-balance-share-toggle"
                />
            </View>
            <Text className="text-xs text-gray-400 mt-2">{t('invite.publicBalance.privacyNote')}</Text>
        </GroupFormSection>
    );
}
