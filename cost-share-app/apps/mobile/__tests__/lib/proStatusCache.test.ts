import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { applyOptimisticProPurchaseCache, refreshProStatusQueries } from '../../lib/proStatusCache';

describe('applyOptimisticProPurchaseCache', () => {
    beforeEach(() => {
        queryClient.clear();
    });

    it('marks global and group pro status as active immediately', () => {
        applyOptimisticProPurchaseCache({
            groupId: 'g1',
            individualUntil: '2027-01-01T00:00:00.000Z',
        });

        const global = queryClient.getQueryData<{ hasPro: boolean }>(queryKeys.proStatus());
        const group = queryClient.getQueryData<{ hasPro: boolean }>(queryKeys.proStatus('g1'));

        expect(global?.hasPro).toBe(true);
        expect(group?.hasPro).toBe(true);
    });

    it('sets group pass until for trip pass only purchases', () => {
        applyOptimisticProPurchaseCache({
            groupId: 'g-trip',
            tripPassOnly: true,
            groupPassUntil: '2026-08-01T00:00:00.000Z',
        });

        const group = queryClient.getQueryData<{ groupPassUntil: string | null; hasPro: boolean }>(
            queryKeys.proStatus('g-trip'),
        );
        expect(group?.hasPro).toBe(true);
        expect(group?.groupPassUntil).toBe('2026-08-01T00:00:00.000Z');
    });

    it('invalidates pro status and subscription queries on refresh', async () => {
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
        await refreshProStatusQueries('g-refresh');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.proStatus() });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.mySubscription() });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.proStatus('g-refresh') });
        invalidateSpy.mockRestore();
    });
});
