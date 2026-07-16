/**
 * FavoriteGroupScreen — root of the Favorite Group tab stack.
 *
 * Resolves the effective favorite group (stored id or first-group fallback) and:
 *  - no groups at all → empty state with a create-group CTA;
 *  - otherwise → GroupDetailScreen (flush top, no SafeAreaView edges=['top']).
 *    The SummaryCover inside GroupDetailScreen handles the top inset itself.
 *
 * #4: Switcher (star+swap) now lives INSIDE the cover action row (via onSwitcherPress).
 *     GroupPickerSheet is managed here and shown above everything.
 *     SafeAreaView edges=['top'] removed — cover is flush to top.
 */
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroupsQuery } from '../../hooks/queries/useGroupsQuery';
import { useEffectiveFavoriteGroupId } from '../../hooks/useEffectiveFavoriteGroupId';
import { GroupPickerSheet } from '../../components/favoriteGroup/GroupPickerSheet';
import { GroupDetailScreen } from '../groups/GroupDetailScreen';
import { EmptyState } from '../../components/EmptyState';
import { useAppStore } from '../../store';

export function FavoriteGroupScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { data: groups = [] } = useGroupsQuery();
    const effectiveGroupId = useEffectiveFavoriteGroupId();
    const setFavoriteGroupId = useAppStore(s => s.setFavoriteGroupId);
    const [pickerOpen, setPickerOpen] = useState(false);

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
    }, [effectiveGroupId, navigation]);

    const handleSwitcherPress = useCallback(() => setPickerOpen(true), []);

    const handleSelect = useCallback(
        (id: string) => {
            setFavoriteGroupId(id);
            setPickerOpen(false);
            navigation.setParams({ groupId: id });
        },
        [setFavoriteGroupId, navigation],
    );

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
        <View className="flex-1 bg-slate-50">
            <GroupDetailScreen showBack={false} onSwitcherPress={handleSwitcherPress} />
            <GroupPickerSheet
                visible={pickerOpen}
                groups={groups}
                selectedGroupId={effectiveGroupId}
                onSelectGroup={handleSelect}
                onClose={() => setPickerOpen(false)}
            />
        </View>
    );
}
