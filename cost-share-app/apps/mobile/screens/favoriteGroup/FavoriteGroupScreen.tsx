/**
 * FavoriteGroupScreen — root of the Favorite Group tab stack.
 *
 * Resolves the effective favorite group (stored id or first-group fallback) and:
 *  - no groups at all → empty state with a create-group CTA;
 *  - otherwise → a "switch group" header (FavoriteGroupSwitcher) above the
 *    REUSED GroupDetailScreen, fed the effective groupId via route params.
 *
 * GroupDetailScreen reads route.params.groupId, so we push the resolved id onto
 * THIS route's params (not a new navigation) before rendering it.
 */
import React, { useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroupsQuery } from '../../hooks/queries/useGroupsQuery';
import { useEffectiveFavoriteGroupId } from '../../hooks/useEffectiveFavoriteGroupId';
import { FavoriteGroupSwitcher } from '../../components/favoriteGroup/FavoriteGroupSwitcher';
import { GroupDetailScreen } from '../groups/GroupDetailScreen';
import { EmptyState } from '../../components/EmptyState';

export function FavoriteGroupScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { data: groups = [] } = useGroupsQuery();
    const effectiveGroupId = useEffectiveFavoriteGroupId();

    const activeGroup = useMemo(
        () => groups.find((g) => g.id === effectiveGroupId) ?? null,
        [groups, effectiveGroupId],
    );

    // Feed GroupDetailScreen the resolved id via this route's params. Runs
    // before paint so GroupDetailScreen reads the right groupId on first render.
    useLayoutEffect(() => {
        if (effectiveGroupId) {
            navigation.setParams({ groupId: effectiveGroupId });
        }
        // TODO(task2): when useMarkGroupSeen from Task 2 is merged, mark the
        // effective group as seen on focus here (spec §משימה 2).
    }, [effectiveGroupId, navigation]);

    if (!effectiveGroupId || !activeGroup) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
                <View testID="favorite-empty" className="flex-1">
                    <EmptyState
                        iconName="star-outline"
                        title={t('favoriteGroup.emptyTitle')}
                        message={t('favoriteGroup.emptyMessage')}
                        actionTitle={t('favoriteGroup.emptyCta')}
                        onAction={() => navigation.navigate('CreateGroup')}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <FavoriteGroupSwitcher
                groupId={effectiveGroupId}
                groupName={activeGroup.name}
                groups={groups}
            />
            <View className="flex-1">
                <GroupDetailScreen />
            </View>
        </SafeAreaView>
    );
}
