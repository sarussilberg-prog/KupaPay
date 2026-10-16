import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Text } from '../AppText';
import { SegmentedControl } from '../expenseV2/SegmentedControl';
import { setAdminProViewMode } from '../../services/admin.service';
import type { AdminProViewMode } from '../../services/proEntitlements.service';
import { queryKeys } from '../../hooks/queries/keys';
import { useProStatus } from '../../hooks/useProStatus';
import { handleError } from '../../lib/handleError';

const MODES: AdminProViewMode[] = ['real', 'force_pro', 'force_free'];

export function AdminProViewModeControl({ testIDPrefix = 'admin-pro-view' }: { testIDPrefix?: string }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { adminProViewMode, adminProViewExpiresAt, isLoading } = useProStatus();
    const [pendingMode, setPendingMode] = useState<AdminProViewMode | null>(null);

    const mutation = useMutation({
        mutationFn: (mode: AdminProViewMode) => setAdminProViewMode(mode),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['proStatus'] });
            setPendingMode(null);
        },
        onError: (err) => {
            setPendingMode(null);
            handleError(err, {
                tags: { service: 'adminProViewMode' },
                toast: { titleKey: 'admin.proView.setFailed' },
            });
        },
    });

    const onChange = useCallback(
        (mode: AdminProViewMode) => {
            if (mode === adminProViewMode || mutation.isPending) return;
            setPendingMode(mode);
            mutation.mutate(mode);
        },
        [adminProViewMode, mutation],
    );

    const displayMode = pendingMode ?? adminProViewMode;
    const expiresLabel =
        adminProViewExpiresAt && displayMode !== 'real'
            ? new Date(adminProViewExpiresAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : null;

    return (
        <View testID={`${testIDPrefix}-section`}>
            <Text className="text-sm text-gray-600 px-4 pb-2">{t('admin.proView.description')}</Text>
            <View className="px-4 pb-2">
                <SegmentedControl
                    value={displayMode}
                    options={MODES.map((value) => ({
                        value,
                        label: t(`admin.proView.mode.${value}`),
                    }))}
                    onChange={onChange}
                    testIDPrefix={testIDPrefix}
                />
            </View>
            {isLoading ? (
                <Text className="text-xs text-gray-400 px-4 pb-2">{t('admin.proView.loading')}</Text>
            ) : expiresLabel ? (
                <Text className="text-xs text-gray-500 px-4 pb-2">
                    {t('admin.proView.expires', { when: expiresLabel })}
                </Text>
            ) : null}
        </View>
    );
}
