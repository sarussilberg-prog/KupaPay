import { registerPushToken, unregisterPushToken } from '../../services/pushTokens.service';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('pushTokens.service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('registers a token with platform + metadata', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
        await registerPushToken({ token: 'ExponentPushToken[a]', platform: 'ios', deviceId: 'd1', appVersion: '1.2.3' });
        expect(supabase.rpc).toHaveBeenCalledWith('register_device_token', {
            p_token: 'ExponentPushToken[a]', p_platform: 'ios', p_device_id: 'd1', p_app_version: '1.2.3',
        });
    });

    it('swallows + logs RPC errors (never throws into auth flow)', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({ error: new Error('boom') });
        await expect(registerPushToken({ token: 't', platform: 'android' })).resolves.toBeUndefined();
    });

    it('unregisters a token', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
        await unregisterPushToken('ExponentPushToken[a]');
        expect(supabase.rpc).toHaveBeenCalledWith('unregister_device_token', { p_token: 'ExponentPushToken[a]' });
    });
});
