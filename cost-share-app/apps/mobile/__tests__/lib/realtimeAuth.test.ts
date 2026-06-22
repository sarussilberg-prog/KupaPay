import { supabase } from '../../lib/supabase';
import { syncRealtimeAuth } from '../../lib/realtimeAuth';

const mockSetAuth = supabase.realtime.setAuth as jest.Mock;

describe('syncRealtimeAuth', () => {
    beforeEach(() => jest.clearAllMocks());

    it('authenticates the realtime socket with the session JWT', () => {
        syncRealtimeAuth({ access_token: 'jwt-123' });
        expect(mockSetAuth).toHaveBeenCalledWith('jwt-123');
    });

    it('clears realtime auth (no token) when there is no session', () => {
        syncRealtimeAuth(null);
        expect(mockSetAuth).toHaveBeenCalledWith();
    });

    it('clears realtime auth when the session has no access token', () => {
        syncRealtimeAuth({ access_token: null });
        expect(mockSetAuth).toHaveBeenCalledWith();
    });
});
