import { UserDashboard } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { useAppStore } from '../store';

export async function fetchDashboard(): Promise<UserDashboard | null> {
    const userId = useAppStore.getState().currentUser?.id ?? (await getCurrentUserId());
    if (!userId) return null;
    const { data, error } = await supabase.rpc('get_user_dashboard', { p_user_id: userId });
    if (error) {
        console.error('fetchDashboard failed:', error);
        return null;
    }
    return data as UserDashboard;
}
