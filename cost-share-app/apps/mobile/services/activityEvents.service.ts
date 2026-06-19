import { supabase } from '../lib/supabase';

export async function removeActivityEvent(eventId: string): Promise<boolean> {
    const { error } = await supabase
        .from('activity_events')
        .delete()
        .eq('id', eventId);
    if (error) {
        console.error('removeActivityEvent failed:', error);
        return false;
    }
    return true;
}
