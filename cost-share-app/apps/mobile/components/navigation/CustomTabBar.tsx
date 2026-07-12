/**
 * CustomTabBar — replaces the default bottom-tabs bar so we can slot a raised
 * "+" FAB in the true center, with the 4 Task-3 tabs balanced 2/2 around it.
 *
 * Centering strategy (RTL-safe): the two tab groups each take flex:1 and the
 * center slot is a fixed-width column (CENTER_ADD_SIZE). This is symmetric in
 * both LTR and RTL — no directional offset math. Row direction comes from
 * useRtlLayout() so tabs mirror correctly for Hebrew.
 */
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../../theme';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useAppStore } from '../../store';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { CenterAddButton, CENTER_ADD_SIZE } from './CenterAddButton';
import { AppIcon } from '../AppIcon';
import { useActivityUnreadCount } from '../../hooks/queries/useActivityUnreadCount';

const ICON_SIZE = 24;

/** Resolve which group the "+" seeds: the favorite group, else the first group. */
function useQuickAddGroupId(): string | undefined {
    const favoriteGroupId = useAppStore((s) => s.favoriteGroupId);
    if (favoriteGroupId) return favoriteGroupId;
    // Read from the shared query-client singleton (the same instance App.tsx
    // wires into QueryClientProvider), so the "+" resolves the first group even
    // when the tab bar renders outside a provider (unit tests).
    const groups =
        queryClient.getQueryData<Array<{ id: string }>>(queryKeys.groups) ?? [];
    return groups[0]?.id;
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const isRtl = useRtlLayout();
    const insets = useSafeAreaInsets();
    const quickAddGroupId = useQuickAddGroupId();
    const { data: unreadCount = 0 } = useActivityUnreadCount();

    const centerIndex = Math.floor(state.routes.length / 2);

    const onQuickAdd = () => {
        if (!quickAddGroupId) return;
        // AddExpense lives on the RootStack (above the tab navigator); resolve
        // up to the parent so navigate finds the modal route.
        const parent = navigation.getParent?.() ?? navigation;
        parent.navigate('AddExpense', { groupId: quickAddGroupId });
    };

    const renderTab = (route: (typeof state.routes)[number], routeIndex: number) => {
        const { options } = descriptors[route.key];
        const focused = state.index === routeIndex;
        const color = focused ? colors.primary : colors.gray400;
        const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;

        const onPress = () => {
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
            }
        };

        return (
            <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
                testID={`tab-${route.name}`}
                onPress={onPress}
                activeOpacity={0.7}
                style={styles.tab}
            >
                {options.tabBarIcon
                    ? options.tabBarIcon({ focused, color, size: ICON_SIZE })
                    : (
                        <AppIcon name="ellipse-outline" size={ICON_SIZE} color={color} />
                    )}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const leading = state.routes.slice(0, centerIndex);
    const trailing = state.routes.slice(centerIndex);

    return (
        <View
            testID="tabbar-row"
            style={[
                styles.row,
                { direction: isRtl ? 'rtl' : 'ltr', paddingBottom: insets.bottom },
            ]}
        >
            <View testID="tabbar-side-leading" style={styles.side}>
                {leading.map((route) =>
                    renderTab(route, state.routes.indexOf(route)),
                )}
            </View>

            <View style={styles.center}>
                <CenterAddButton onPress={onQuickAdd} />
            </View>

            <View testID="tabbar-side-trailing" style={styles.side}>
                {trailing.map((route) =>
                    renderTab(route, state.routes.indexOf(route)),
                )}
            </View>

            {/* Activity unread badge is rendered by the tab's own icon (see
                AppNavigator). unreadCount is read here only to keep the count
                query warm; per-icon badge lives in the icon renderer. */}
            {void unreadCount}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.default,
        paddingTop: 6,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
            },
            android: { elevation: 8 },
            default: {},
        }),
    },
    side: {
        flex: 1,
        flexDirection: 'row',
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    label: {
        fontSize: 10,
        marginTop: 2,
    },
    center: {
        width: CENTER_ADD_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
