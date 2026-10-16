import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { IconLabel } from '../../../components/ui/IconLabel';
import { ICON_LABEL_BOX_WIDTH, ICON_LABEL_GAP } from '../../../components/ui/iconLabelLayout';

jest.mock('../../../hooks/useRtlLayout', () => {
    const actual = jest.requireActual('../../../hooks/useRtlLayout');
    return {
        ...actual,
        useRtlLayout: jest.fn(() => false),
    };
});

const { useRtlLayout } = jest.requireMock('../../../hooks/useRtlLayout') as {
    useRtlLayout: jest.Mock;
};

describe('IconLabel', () => {
    beforeEach(() => {
        useRtlLayout.mockReturnValue(false);
    });

    it('uses fixed icon box width and theme gap in LTR', () => {
        const { getByTestId } = render(
            <IconLabel
                iconName="globe-outline"
                iconColor="#666"
                label="Language"
                testID="icon-label"
            />,
        );
        const row = getByTestId('icon-label');
        const flat = Object.assign({}, ...row.props.style.filter(Boolean));
        expect(flat.gap ?? flat.columnGap).toBe(ICON_LABEL_GAP);
        if (Platform.OS === 'web') {
            expect(flat.direction).toBe('ltr');
        } else {
            expect(flat.flexDirection).toBe('row');
        }
        const iconBox = row.children[0] as { props: { style: { width: number } } };
        expect(iconBox.props.style.width).toBe(ICON_LABEL_BOX_WIDTH);
    });

    it('mirrors row direction for Hebrew (RTL)', () => {
        useRtlLayout.mockReturnValue(true);
        const { getByTestId } = render(
            <IconLabel iconName="globe-outline" iconColor="#666" label="שפה" testID="icon-label-rtl" />,
        );
        const row = getByTestId('icon-label-rtl');
        const flat = Object.assign({}, ...row.props.style.filter(Boolean));
        if (Platform.OS === 'web') {
            expect(flat.direction).toBe('rtl');
        } else {
            expect(flat.flexDirection).toBe('row-reverse');
        }
    });
});
