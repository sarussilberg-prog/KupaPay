import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import {
    LayoutWindowWidthProvider,
    useLayoutWindowWidth,
} from '../../hooks/useLayoutWindowWidth';

function Probe() {
    const width = useLayoutWindowWidth();
    return <Text testID="width-probe">{width}</Text>;
}

describe('useLayoutWindowWidth', () => {
    it('uses the provider override when present', () => {
        const { getByTestId } = render(
            <LayoutWindowWidthProvider width={375}>
                <Probe />
            </LayoutWindowWidthProvider>,
        );
        expect(getByTestId('width-probe').props.children).toBe(375);
    });
});
