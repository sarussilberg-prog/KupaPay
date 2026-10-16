import { Platform } from 'react-native';
import {
    SETTINGS_VALUE_LABEL_GAP,
    settingsRowValueClusterStyle,
    settingsRowValueTextStyle,
    settingsRowValueTrailingSpacerStyle,
} from '../../../components/settings/settingsRowLayout';
import { spacing } from '../../../theme';

describe('settingsRowLayout', () => {
    it('uses compact theme gap between label and value', () => {
        expect(SETTINGS_VALUE_LABEL_GAP).toBe(spacing.sm);
        const ltr = settingsRowValueClusterStyle(false);
        expect(ltr.gap ?? ltr.columnGap).toBe(SETTINGS_VALUE_LABEL_GAP);
    });

    it('clusters label and value on the leading side without growing', () => {
        const style = settingsRowValueClusterStyle(false);
        expect(style.flexGrow).toBe(0);
        expect(style.flexShrink).toBe(1);
        expect(style.minWidth).toBe(0);
        if (Platform.OS === 'web') {
            expect(style.direction).toBe('ltr');
        } else {
            expect(style.flexDirection).toBe('row');
        }
    });

    it('mirrors cluster direction for RTL', () => {
        const style = settingsRowValueClusterStyle(true);
        if (Platform.OS === 'web') {
            expect(style.direction).toBe('rtl');
        } else {
            expect(style.flexDirection).toBe('row-reverse');
        }
    });

    it('allows value text to shrink and truncate', () => {
        expect(settingsRowValueTextStyle()).toEqual({
            flexShrink: 1,
            minWidth: 0,
        });
    });

    it('reserves flexible space before the chevron', () => {
        expect(settingsRowValueTrailingSpacerStyle()).toEqual({
            flexGrow: 1,
            flexShrink: 1,
            minWidth: spacing.sm,
        });
    });
});
