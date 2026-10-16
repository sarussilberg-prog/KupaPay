import { isAdminProViewOverrideActive } from '../../hooks/useProStatus';

describe('isAdminProViewOverrideActive', () => {
    it('is false for real mode', () => {
        expect(isAdminProViewOverrideActive('real')).toBe(false);
        expect(isAdminProViewOverrideActive(undefined)).toBe(false);
    });

    it('is true for force modes', () => {
        expect(isAdminProViewOverrideActive('force_pro')).toBe(true);
        expect(isAdminProViewOverrideActive('force_free')).toBe(true);
    });
});
