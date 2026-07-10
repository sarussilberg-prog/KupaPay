import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomTabBar } from '../../components/navigation/CustomTabBar';
import { useAppStore } from '../../store';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';

// Silence the Activity unread-count query network dependency.
jest.mock('../../hooks/queries/useActivityUnreadCount', () => ({
    useActivityUnreadCount: () => ({ data: 0 }),
}));

const ROUTE_NAMES = ['Groups', 'Activity', 'Favorite', 'Profile'];

function makeProps(overrides?: {
    navigate?: jest.Mock;
    getParent?: jest.Mock;
    index?: number;
}) {
    const navigate = overrides?.navigate ?? jest.fn();
    const routes = ROUTE_NAMES.map((name, i) => ({
        key: `${name}-${i}`,
        name,
    }));
    const descriptors = Object.fromEntries(
        routes.map((r) => [
            r.key,
            {
                options: {
                    tabBarLabel: r.name,
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Text testID={`icon-${r.name}`}>{`${r.name}:${size}:${color}`}</Text>
                    ),
                },
            },
        ]),
    );
    return {
        state: { index: overrides?.index ?? 0, routes },
        descriptors,
        navigation: {
            navigate: jest.fn(),
            emit: jest.fn(() => ({ defaultPrevented: false })),
            getParent: overrides?.getParent ?? jest.fn(() => ({ navigate })),
        },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
    } as any;
}

beforeEach(() => {
    queryClient.clear();
    useAppStore.setState({ language: 'en', favoriteGroupId: 'g-favorite' } as any);
});

describe('CustomTabBar', () => {
    it('renders all four tab labels plus the center add button', () => {
        const { getByText, getByTestId } = render(<CustomTabBar {...makeProps()} />);
        ROUTE_NAMES.forEach((name) => expect(getByText(name)).toBeTruthy());
        expect(getByTestId('center-add-button')).toBeTruthy();
    });

    it('places the center button in the middle (2 tabs each side)', () => {
        const { getByTestId } = render(<CustomTabBar {...makeProps()} />);
        const left = getByTestId('tabbar-side-leading');
        const right = getByTestId('tabbar-side-trailing');
        // Each side wraps exactly two tab buttons. findAllByProps traverses the
        // full render tree, so each TouchableOpacity yields several nodes that
        // carry accessibilityRole="button" (the composite + its Animated/host
        // Views). Count DISTINCT tab buttons by their unique testID instead.
        const distinctTabIds = (node: ReturnType<typeof getByTestId>) =>
            new Set(
                node
                    .findAllByProps({ accessibilityRole: 'button' })
                    .map((n: { props: { testID?: string } }) => n.props.testID)
                    .filter((id: string | undefined) => id?.startsWith('tab-')),
            ).size;
        expect(distinctTabIds(left)).toBe(2);
        expect(distinctTabIds(right)).toBe(2);
    });

    it('pressing "+" navigates to AddExpense with the favorite group id', () => {
        const navigate = jest.fn();
        const getParent = jest.fn(() => ({ navigate }));
        const { getByTestId } = render(
            <CustomTabBar {...makeProps({ getParent })} />,
        );
        fireEvent.press(getByTestId('center-add-button'));
        expect(navigate).toHaveBeenCalledWith('AddExpense', { groupId: 'g-favorite' });
    });

    it('falls back to the first group when favoriteGroupId is empty', () => {
        useAppStore.setState({ favoriteGroupId: null } as any);
        queryClient.setQueryData(queryKeys.groups, [
            { id: 'g-first', name: 'First' },
            { id: 'g-second', name: 'Second' },
        ]);
        const navigate = jest.fn();
        const getParent = jest.fn(() => ({ navigate }));
        const { getByTestId } = render(
            <CustomTabBar {...makeProps({ getParent })} />,
        );
        fireEvent.press(getByTestId('center-add-button'));
        expect(navigate).toHaveBeenCalledWith('AddExpense', { groupId: 'g-first' });
    });

    it('mirrors the row direction in RTL (Hebrew)', () => {
        useAppStore.setState({ language: 'he' } as any);
        const { getByTestId } = render(<CustomTabBar {...makeProps()} />);
        const row = getByTestId('tabbar-row');
        expect(row.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ direction: 'rtl' }),
            ]),
        );
    });
});
