const mockMark = jest.fn().mockResolvedValue(undefined);

jest.mock('../../lib/deactivationNoticeStorage', () => ({
    markDeactivationNoticePending: (...args: unknown[]) => mockMark(...args),
}));

import { Platform } from 'react-native';
import { signalDeactivatedAccount } from '../../lib/signalDeactivatedAccount';

describe('signalDeactivatedAccount', () => {
    beforeEach(() => {
        mockMark.mockClear();
    });

    it('sets in-memory pending flag on all platforms', async () => {
        const setPending = jest.fn();
        await signalDeactivatedAccount(setPending);
        expect(setPending).toHaveBeenCalledWith(true);
    });

    it('persists the notice only on web', async () => {
        const setPending = jest.fn();
        const originalOs = Platform.OS;

        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        await signalDeactivatedAccount(setPending);
        expect(mockMark).not.toHaveBeenCalled();

        mockMark.mockClear();
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        await signalDeactivatedAccount(setPending);
        expect(mockMark).toHaveBeenCalled();

        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    });
});
