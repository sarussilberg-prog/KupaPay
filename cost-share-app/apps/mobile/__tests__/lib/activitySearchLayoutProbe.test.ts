import { isActivitySearchFieldTrailingAligned } from '../../lib/activitySearchLayoutProbe';

describe('isActivitySearchFieldTrailingAligned', () => {
    it('passes in LTR without measuring', () => {
        expect(isActivitySearchFieldTrailingAligned({ x: 0, width: 100 }, { width: 200 }, false)).toBe(
            true,
        );
    });

    it('requires the field trailing edge near the pill width in RTL', () => {
        expect(isActivitySearchFieldTrailingAligned({ x: 8, width: 192 }, { width: 200 }, true)).toBe(
            true,
        );
        expect(isActivitySearchFieldTrailingAligned({ x: 10, width: 120 }, { width: 200 }, true)).toBe(
            false,
        );
    });
});
