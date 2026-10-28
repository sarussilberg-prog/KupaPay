import React from 'react';
import { render } from '@testing-library/react-native';
import { HotVirtualizedList } from '../../../components/lists/HotVirtualizedList';

const mockFlashList = jest.fn((_props: Record<string, unknown>) => null);

jest.mock('@shopify/flash-list', () => {
    const React = jest.requireActual('react');
    return {
        FlashList: React.forwardRef(function MockFlashList(props: Record<string, unknown>, _ref: unknown) {
            mockFlashList(props);
            return null;
        }),
    };
});

describe('HotVirtualizedList', () => {
    beforeEach(() => {
        mockFlashList.mockClear();
    });

    it('renders through FlashList (virtualization regression guard)', () => {
        render(
            <HotVirtualizedList
                data={[{ id: '1' }]}
                keyExtractor={(item) => item.id}
                renderItem={() => null}
                testID="custom-hot-list"
            />,
        );
        expect(mockFlashList).toHaveBeenCalled();
        const firstCall = mockFlashList.mock.calls[0]?.[0] as { testID?: string };
        expect(firstCall?.testID).toBe('custom-hot-list');
    });
});
