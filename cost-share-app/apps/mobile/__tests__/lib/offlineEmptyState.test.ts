import { resolveEmptyStateVariant } from '../../lib/offlineEmptyState';

describe('resolveEmptyStateVariant', () => {
    it('shows the offline variant when the device is offline', () => {
        expect(resolveEmptyStateVariant({ online: false, hasError: false })).toBe('offline');
    });

    it('prefers the offline variant over a generic load error when offline', () => {
        // Offline IS the reason the load failed, so the honest, useful message
        // is "you're offline (and here's what you can still do)", not a bare
        // "failed to load".
        expect(resolveEmptyStateVariant({ online: false, hasError: true })).toBe('offline');
    });

    it('shows the error variant when online but the load failed', () => {
        expect(resolveEmptyStateVariant({ online: true, hasError: true })).toBe('error');
    });

    it('shows the plain empty variant when online with no error', () => {
        expect(resolveEmptyStateVariant({ online: true, hasError: false })).toBe('empty');
    });
});
