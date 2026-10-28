import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

const mockUseRoute = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useRoute: () => mockUseRoute(),
}));

import {
    hasNonEmptyStringParams,
    readRouteParams,
    useRequiredRouteParams,
} from '../../hooks/useRequiredRouteParams';

describe('readRouteParams', () => {
    it('returns an empty object when params are undefined', () => {
        expect(readRouteParams({ params: undefined })).toEqual({});
    });
});

describe('hasNonEmptyStringParams', () => {
    it('requires every key to be a non-empty string', () => {
        expect(hasNonEmptyStringParams({ groupId: 'g1' }, ['groupId'])).toBe(true);
        expect(hasNonEmptyStringParams({ groupId: '' }, ['groupId'])).toBe(false);
        expect(hasNonEmptyStringParams({}, ['groupId'])).toBe(false);
    });
});

function Probe({ keys }: { keys: readonly ('groupId' | 'expenseId')[] }) {
    const { isValid, required } = useRequiredRouteParams(keys);
    return (
        <Text testID="probe">
            {isValid ? `ok:${required?.groupId ?? required?.expenseId}` : 'invalid'}
        </Text>
    );
}

describe('useRequiredRouteParams', () => {
    beforeEach(() => {
        mockUseRoute.mockReset();
    });

    it('marks route params invalid when the navigator omits params (deep link / cold restore)', () => {
        mockUseRoute.mockReturnValue({ params: undefined });
        const { getByTestId } = render(<Probe keys={['groupId']} />);
        expect(getByTestId('probe').props.children).toBe('invalid');
    });

    it('accepts valid string params', () => {
        mockUseRoute.mockReturnValue({ params: { groupId: 'g1' } });
        const { getByTestId } = render(<Probe keys={['groupId']} />);
        expect(getByTestId('probe').props.children).toBe('ok:g1');
    });
});
