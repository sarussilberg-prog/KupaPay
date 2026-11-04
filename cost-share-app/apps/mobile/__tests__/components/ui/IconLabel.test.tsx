import React from 'react';
import { I18nManager } from 'react-native';
import { render } from '@testing-library/react-native';
import { IconLabel } from '../../../components/ui/IconLabel';
import { ICON_LABEL_BOX_WIDTH, ICON_LABEL_GAP } from '../../../components/ui/iconLabelLayout';
import { RtlLayoutProvider } from '../../../hooks/useRtlLayout';
import { useAppStore } from '../../../store';

function renderIconLabel(ui: React.ReactElement, language: 'en' | 'he' = 'en') {
    useAppStore.setState({ language });
    (I18nManager as unknown as { isRTL: boolean }).isRTL = language === 'he';
    return render(<RtlLayoutProvider>{ui}</RtlLayoutProvider>);
}

describe('IconLabel', () => {
    afterEach(() => {
        useAppStore.setState({ language: 'en' });
        (I18nManager as unknown as { isRTL: boolean }).isRTL = false;
    });

    it('uses fixed icon box width and theme gap in LTR', () => {
        const { getByTestId } = renderIconLabel(
            <IconLabel
                iconName="globe-outline"
                iconColor="#666"
                label="Language"
                testID="icon-label"
            />,
            'en',
        );
        const row = getByTestId('icon-label');
        const flat = Object.assign({}, ...row.props.style.filter(Boolean));
        expect(flat.gap ?? flat.columnGap).toBe(ICON_LABEL_GAP);
        expect(flat.flexDirection).toBe('row');
        const iconBox = row.children[0] as { props: { style: { width: number } } };
        expect(iconBox.props.style.width).toBe(ICON_LABEL_BOX_WIDTH);
    });

    it('mirrors row direction for Hebrew (RTL) when native is synced', () => {
        const { getByTestId } = renderIconLabel(
            <IconLabel iconName="globe-outline" iconColor="#666" label="Language" testID="icon-label-rtl" />,
            'he',
        );
        const row = getByTestId('icon-label-rtl');
        const flat = Object.assign({}, ...row.props.style.filter(Boolean));
        expect(flat.flexDirection).toBe('row');
    });
});
