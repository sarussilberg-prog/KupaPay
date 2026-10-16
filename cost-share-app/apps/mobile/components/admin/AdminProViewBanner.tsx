import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Text } from '../AppText';
import { useProStatus } from '../../hooks/useProStatus';
import { setAdminProViewMode } from '../../services/admin.service';
import { useAppStore } from '../../store';

export function AdminProViewBanner() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const isAdmin = useAppStore((s) => s.currentUser?.isAdmin === true);
    const { adminProViewMode, adminProViewOverrideActive } = useProStatus();
    const queryClient = useQueryClient();

    const resetMutation = useMutation({
        mutationFn: () => setAdminProViewMode('real'),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['proStatus'] });
        },
    });

    const onPress = useCallback(() => {
        if (!resetMutation.isPending) resetMutation.mutate();
    }, [resetMutation]);

    if (!isAdmin || !adminProViewOverrideActive) return null;

    const labelKey =
        adminProViewMode === 'force_pro' ? 'admin.proView.bannerPro' : 'admin.proView.bannerFree';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="admin-pro-view-banner"
            style={{
                paddingTop: Math.max(insets.top, 4),
                paddingBottom: 8,
                paddingHorizontal: 12,
                backgroundColor: '#422006',
            }}
        >
            <View>
                <Text className="text-xs font-semibold text-amber-100 text-center">
                    {t(labelKey)}
                </Text>
                <Text className="text-[10px] text-amber-200/80 text-center mt-0.5">
                    {t('admin.proView.bannerResetHint')}
                </Text>
            </View>
        </TouchableOpacity>
    );
}
