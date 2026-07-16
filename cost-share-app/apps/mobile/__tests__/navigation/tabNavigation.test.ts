import { CommonActions, StackActions } from '@react-navigation/native';
import {
    canPopWithinStack,
    createTabPopToTopListener,
    exitGroupToGroupsList,
} from '../../navigation/tabNavigation';

describe('canPopWithinStack', () => {
    it('is false at stack root', () => {
        expect(
            canPopWithinStack({
                dispatch: jest.fn(),
                getState: () => ({ index: 0, routes: [{ name: 'GroupsList' }] }),
            }),
        ).toBe(false);
    });

    it('is true when a deeper screen is focused', () => {
        expect(
            canPopWithinStack({
                dispatch: jest.fn(),
                getState: () => ({
                    index: 1,
                    routes: [{ name: 'GroupsList' }, { name: 'GroupDetail' }],
                }),
            }),
        ).toBe(true);
    });
});

describe('exitGroupToGroupsList', () => {
    it('pops to top when GroupsList is under the current route', () => {
        const dispatch = jest.fn();
        exitGroupToGroupsList({
            dispatch,
            getState: () => ({
                index: 1,
                routes: [{ name: 'GroupsList' }, { name: 'GroupDetail' }],
            }),
        });
        expect(dispatch).toHaveBeenCalledWith(StackActions.popToTop());
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'GO_BACK' }),
        );
    });

    it('navigates to GroupsList root when GroupsList is not under current route', () => {
        const dispatch = jest.fn();
        exitGroupToGroupsList({
            dispatch,
            getState: () => ({
                index: 0,
                routes: [{ name: 'GroupDetail' }],
            }),
        });
        expect(dispatch).toHaveBeenCalledWith(
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
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'GO_BACK' }),
        );
    });

    it('never dispatches bare tab goBack after popToTop', () => {
        const dispatch = jest.fn();
        exitGroupToGroupsList({
            dispatch,
            getState: () => ({
                index: 2,
                routes: [
                    { name: 'GroupsList' },
                    { name: 'GroupDetail' },
                    { name: 'ExpenseDetail' },
                ],
            }),
        });
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(StackActions.popToTop());
    });
});

describe('createTabPopToTopListener', () => {
    function buildNav(opts: {
        focused: boolean;
        nestedState?: {
            key?: string;
            index?: number;
            routes: Array<{ name: string; key?: string }>;
        };
    }) {
        const routeKey = 'tab-groups';
        const dispatch = jest.fn();
        const navigate = jest.fn();
        const navigation = {
            isFocused: () => opts.focused,
            dispatch,
            navigate,
            getState: () => ({
                routes: [
                    {
                        key: routeKey,
                        name: 'Groups',
                        state: opts.nestedState,
                    },
                ],
                index: 0,
            }),
        };
        const route = { key: routeKey, name: 'Groups' };
        return { navigation, route, dispatch, navigate };
    }

    it('dispatches popToTop with nested stack target when focused and nested', () => {
        const { navigation, route, dispatch, navigate } = buildNav({
            focused: true,
            nestedState: {
                key: 'groups-stack-key',
                index: 1,
                routes: [{ name: 'GroupsList' }, { name: 'GroupDetail' }],
            },
        });
        const listeners = createTabPopToTopListener('GroupsList')({
            navigation: navigation as never,
            route: route as never,
        });
        const preventDefault = jest.fn();
        listeners.tabPress({ preventDefault });

        expect(preventDefault).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({
            ...StackActions.popToTop(),
            target: 'groups-stack-key',
        });
        expect(navigate).not.toHaveBeenCalled();
    });

    it('resets tab to initial when nested state has no key', () => {
        const { navigation, route, dispatch } = buildNav({
            focused: true,
            nestedState: {
                index: 1,
                routes: [{ name: 'GroupsList' }, { name: 'GroupDetail' }],
            },
        });
        const listeners = createTabPopToTopListener('GroupsList')({
            navigation: navigation as never,
            route: route as never,
        });
        listeners.tabPress({ preventDefault: jest.fn() });

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'NAVIGATE',
                payload: expect.objectContaining({
                    name: 'Groups',
                    params: {
                        state: {
                            routes: [{ name: 'GroupsList' }],
                            index: 0,
                        },
                    },
                }),
            }),
        );
    });

    it('resets orphan GroupDetail stack (no GroupsList under) to GroupsList', () => {
        const { navigation, route, dispatch } = buildNav({
            focused: true,
            nestedState: {
                key: 'groups-stack-key',
                index: 0,
                routes: [{ name: 'GroupDetail' }],
            },
        });
        const listeners = createTabPopToTopListener('GroupsList')({
            navigation: navigation as never,
            route: route as never,
        });
        const preventDefault = jest.fn();
        listeners.tabPress({ preventDefault });

        expect(preventDefault).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'NAVIGATE',
                payload: expect.objectContaining({
                    name: 'Groups',
                    params: {
                        state: {
                            routes: [{ name: 'GroupsList' }],
                            index: 0,
                        },
                    },
                }),
            }),
        );
    });

    it('is a no-op at root', () => {
        const { navigation, route, dispatch, navigate } = buildNav({
            focused: true,
            nestedState: {
                key: 'groups-stack-key',
                index: 0,
                routes: [{ name: 'GroupsList' }],
            },
        });
        const listeners = createTabPopToTopListener('GroupsList')({
            navigation: navigation as never,
            route: route as never,
        });
        const preventDefault = jest.fn();
        listeners.tabPress({ preventDefault });

        expect(preventDefault).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('does not dispatch when tab is unfocused', () => {
        const { navigation, route, dispatch } = buildNav({
            focused: false,
            nestedState: {
                key: 'groups-stack-key',
                index: 1,
                routes: [{ name: 'GroupsList' }, { name: 'GroupDetail' }],
            },
        });
        const listeners = createTabPopToTopListener('GroupsList')({
            navigation: navigation as never,
            route: route as never,
        });
        listeners.tabPress({ preventDefault: jest.fn() });
        expect(dispatch).not.toHaveBeenCalled();
    });
});
