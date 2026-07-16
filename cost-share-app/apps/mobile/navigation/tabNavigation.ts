/**
 * Tab re-press pop-to-top + safe exit from GroupDetail.
 * See docs/superpowers/specs/2026-05-23-tab-navigation-reset-design.md
 */
import {
    CommonActions,
    StackActions,
    type ParamListBase,
    type RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { shouldPopStackToInitial } from './shouldPopStackToInitial';

type StackNavLike = {
    dispatch: (action: object) => void;
    getState: () =>
        | {
              key?: string;
              index?: number;
              routes: Array<{ name: string; key?: string }>;
          }
        | undefined;
};

/** True when this navigator's stack has a screen under the focused route. */
export function canPopWithinStack(navigation: StackNavLike): boolean {
    return (navigation.getState()?.index ?? 0) > 0;
}

function resetTabToInitial(
    navigation: BottomTabNavigationProp<ParamListBase>,
    tabName: string,
    initialScreen: string,
): void {
    navigation.dispatch(
        CommonActions.navigate({
            name: tabName,
            params: {
                state: {
                    routes: [{ name: initialScreen }],
                    index: 0,
                },
            },
        }),
    );
}

/**
 * Leave a group screen to GroupsList without bubbling GO_BACK to the tab
 * router (which would land on Profile via backBehavior: firstRoute).
 */
export function exitGroupToGroupsList(navigation: StackNavLike): void {
    const state = navigation.getState();
    const hasGroupsListUnder =
        Boolean(state?.routes?.some((r) => r.name === 'GroupsList')) &&
        (state?.index ?? 0) > 0;

    if (hasGroupsListUnder) {
        navigation.dispatch(StackActions.popToTop());
        return;
    }

    navigation.dispatch(
        CommonActions.navigate({
            name: 'Groups',
            params: {
                state: {
                    routes: [{ name: 'GroupsList' }],
                    index: 0,
                },
            },
        }),
    );
}

/**
 * When the already-focused tab is pressed again and its nested stack is not
 * at the initial screen, pop that nested stack to its root.
 *
 * Orphan stacks (e.g. GroupDetail as the only route after a cross-tab
 * navigate) cannot use popToTop — reset the tab to the initial screen.
 */
export function createTabPopToTopListener(initialScreen: string) {
    return ({
        navigation,
        route,
    }: {
        navigation: BottomTabNavigationProp<ParamListBase>;
        route: RouteProp<ParamListBase>;
    }) => ({
        tabPress: (e: { preventDefault: () => void }) => {
            if (!navigation.isFocused()) return;

            const nestedState = navigation
                .getState()
                .routes.find((r) => r.key === route.key)?.state;

            if (!shouldPopStackToInitial(nestedState, initialScreen)) return;

            e.preventDefault();

            const routes = nestedState?.routes ?? [];
            const hasInitialUnder =
                routes.some((r) => r.name === initialScreen) &&
                (nestedState?.index ?? 0) > 0;
            const targetKey =
                nestedState && 'key' in nestedState && typeof nestedState.key === 'string'
                    ? nestedState.key
                    : undefined;

            if (hasInitialUnder && targetKey) {
                navigation.dispatch({
                    ...StackActions.popToTop(),
                    target: targetKey,
                });
                return;
            }

            resetTabToInitial(navigation, route.name, initialScreen);
        },
    });
}
