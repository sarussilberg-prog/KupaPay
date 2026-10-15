import { isAppVersionBelowMinimum } from '../../lib/appVersionCompare';

describe('isAppVersionBelowMinimum', () => {
    it('returns true when patch is behind', () => {
        expect(isAppVersionBelowMinimum('1.2.0', '2.1.0')).toBe(true);
    });

    it('returns false when equal', () => {
        expect(isAppVersionBelowMinimum('2.1.0', '2.1.0')).toBe(false);
    });

    it('returns false when ahead', () => {
        expect(isAppVersionBelowMinimum('2.2.0', '2.1.0')).toBe(false);
    });
});
