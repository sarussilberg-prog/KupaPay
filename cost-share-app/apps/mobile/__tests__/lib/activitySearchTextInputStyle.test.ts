import { activitySearchTextInputResolvedProps, activitySearchTextInputStyle } from '../../lib/activitySearchTextInputStyle';

describe('activitySearchTextInputStyle (#716)', () => {
    it.each([
        ['en', 'left' as const],
        ['he', 'right' as const],
        ['ar', 'right' as const],
    ])('locale %s resolves textAlign=%s without writingDirection on TextInput', (locale, textAlign) => {
        expect(activitySearchTextInputResolvedProps(locale as 'en')).toEqual({
            textAlign,
            writingDirection: undefined,
        });
        expect(activitySearchTextInputStyle(locale as 'en').textAlign).toBe(textAlign);
        expect(activitySearchTextInputStyle(locale as 'en').writingDirection).toBeUndefined();
    });
});
