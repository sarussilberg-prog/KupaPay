import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queries/keys';
import { runActivityScreenFocusEffects } from '../../lib/activityScreenFocus';

describe('runActivityScreenFocusEffects (#698)', () => {
    it('returns watermark and clears badge after successful mark_seen', async () => {
        const watermark = new Date('2026-05-01T12:00:00.000Z');
        const clearBadge = jest.fn();
        const queryClient = new QueryClient();
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

        const result = await runActivityScreenFocusEffects({
            fetchWatermark: async () => watermark,
            markSeen: async () => ({ error: null }),
            queryClient,
            clearBadge,
        });

        expect(result).toEqual(watermark);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.activityUnreadCount });
        expect(clearBadge).toHaveBeenCalledTimes(1);
        invalidateSpy.mockRestore();
    });

    it('does not clear badge when mark_seen fails', async () => {
        const clearBadge = jest.fn();
        const queryClient = new QueryClient();
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

        await runActivityScreenFocusEffects({
            fetchWatermark: async () => null,
            markSeen: async () => ({ error: new Error('rpc failed') }),
            queryClient,
            clearBadge,
        });

        expect(clearBadge).not.toHaveBeenCalled();
        expect(invalidateSpy).not.toHaveBeenCalled();
        invalidateSpy.mockRestore();
    });

    it('still returns watermark when clearBadge throws synchronously', async () => {
        const watermark = new Date('2026-06-01T00:00:00.000Z');
        const clearBadge = jest.fn(() => {
            throw new Error('badge native crash');
        });

        const result = await runActivityScreenFocusEffects({
            fetchWatermark: async () => watermark,
            markSeen: async () => ({ error: null }),
            queryClient: new QueryClient(),
            clearBadge,
        });

        expect(result).toEqual(watermark);
        expect(clearBadge).toHaveBeenCalled();
    });
});
