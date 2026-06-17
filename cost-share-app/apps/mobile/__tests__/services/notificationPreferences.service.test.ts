import { fetchNotificationPreferences, saveNotificationPreferences } from '../../services/notificationPreferences.service';
import { supabase } from '../../lib/supabase';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@cost-share/shared';

jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: jest.fn(), from: jest.fn() },
}));

describe('notificationPreferences.service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns defaults when no row exists', async () => {
        (supabase.from as jest.Mock).mockReturnValue({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        });
        const prefs = await fetchNotificationPreferences('u1');
        expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it('maps snake_case row to camelCase', async () => {
        (supabase.from as jest.Mock).mockReturnValue({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
                data: { push_enabled: true, expenses_push: false, settlements_push: true,
                    messages_push: false, friends_push: true, groups_push: true }, error: null }) }) }),
        });
        const prefs = await fetchNotificationPreferences('u1');
        expect(prefs.expensesPush).toBe(false);
        expect(prefs.messagesPush).toBe(false);
    });

    it('sends camelCase prefs as snake_case JSON to the RPC', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
        await saveNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, messagesPush: false });
        expect(supabase.rpc).toHaveBeenCalledWith('update_notification_preferences', {
            p_prefs: expect.objectContaining({ messages_push: false, push_enabled: true }),
        });
    });
});
