import { removeActivityEvent } from '../../services/activityEvents.service';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => {
    const eq = jest.fn();
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    return {
        supabase: { from },
        __mocks: { from, del, eq },
    };
});

const mocks = (jest.requireMock('../../lib/supabase') as { __mocks: { from: jest.Mock; del: jest.Mock; eq: jest.Mock } }).__mocks;

describe('removeActivityEvent', () => {
    beforeEach(() => {
        mocks.from.mockClear();
        mocks.del.mockClear();
        mocks.eq.mockClear();
    });

    it('issues a delete on activity_events filtered by id', async () => {
        mocks.eq.mockResolvedValueOnce({ error: null });
        const ok = await removeActivityEvent('evt-1');
        expect(mocks.from).toHaveBeenCalledWith('activity_events');
        expect(mocks.del).toHaveBeenCalled();
        expect(mocks.eq).toHaveBeenCalledWith('id', 'evt-1');
        expect(ok).toBe(true);
    });

    it('returns false when supabase returns an error', async () => {
        mocks.eq.mockResolvedValueOnce({ error: { message: 'rls', code: '42501' } });
        const ok = await removeActivityEvent('evt-2');
        expect(ok).toBe(false);
    });
});
