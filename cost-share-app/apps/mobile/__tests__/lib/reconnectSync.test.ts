import { QueryClient, onlineManager } from '@tanstack/react-query';
import { retryConnectivitySync } from '../../lib/reconnectSync';
import { sweepIfOnline } from '../../lib/zombieSweep';

jest.mock('../../lib/zombieSweep', () => ({
    sweepIfOnline: jest.fn(),
}));

describe('retryConnectivitySync', () => {
    it('no-ops while offline', async () => {
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(false);
        const client = new QueryClient();
        const resume = jest.spyOn(client, 'resumePausedMutations').mockResolvedValue(undefined);
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

        await retryConnectivitySync(client);

        expect(sweepIfOnline).not.toHaveBeenCalled();
        expect(resume).not.toHaveBeenCalled();
        expect(invalidate).not.toHaveBeenCalled();
    });

    it('sweeps, resumes mutations, and refetches active queries when online', async () => {
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        const client = new QueryClient();
        const resume = jest.spyOn(client, 'resumePausedMutations').mockResolvedValue(undefined);
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

        await retryConnectivitySync(client);

        expect(sweepIfOnline).toHaveBeenCalledWith(client);
        expect(resume).toHaveBeenCalled();
        expect(invalidate).toHaveBeenCalledWith({ refetchType: 'active' });
    });
});
