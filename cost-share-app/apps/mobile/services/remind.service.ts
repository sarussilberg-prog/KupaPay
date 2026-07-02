import { supabase } from '../lib/supabase';
import { showSuccessMessage, showErrorToast } from '../lib/appToast';
import { shareTextMessage } from '../lib/platformShare';
import { logMonetizationEvent } from './monetization.service';
import { buildSettleReminderUrl } from './invite.service';

export interface SendReminderParams {
    groupId: string;
    toUserId: string;
    message: string;
    featureKey?: string;
}

/**
 * Sends a push notification reminder via KupaPay.
 * Calls the send_settle_reminder RPC which inserts an activity_events row,
 * triggering the existing push pipeline automatically.
 */
export async function sendSettleReminder({
    groupId,
    toUserId,
    message,
    featureKey = 'remind_user',
}: SendReminderParams): Promise<boolean> {
    const { error } = await supabase.rpc('send_settle_reminder', {
        p_group_id: groupId,
        p_to_user_id: toUserId,
        p_message: message,
    });

    if (error) {
        showErrorToast('common.errorGeneric');
        return false;
    }

    void logMonetizationEvent(featureKey, 'remind_sent');
    showSuccessMessage('remind.sent');
    return true;
}

/**
 * Builds the share URL for a settlement reminder deep link.
 * Uses the group's invite_token (already on every group row) with /sr/ path.
 */
export async function getSettleReminderShareUrl(groupId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('groups')
        .select('invite_token')
        .eq('id', groupId)
        .maybeSingle();

    if (error || !data?.invite_token) return null;

    return buildSettleReminderUrl(data.invite_token);
}

/**
 * Shares a settlement reminder via the native share sheet.
 * Includes the custom message and a deep link to the group's settle-up screen.
 */
export async function shareSettleReminder({
    groupId,
    message,
    featureKey = 'remind_user',
}: {
    groupId: string;
    message: string;
    featureKey?: string;
}): Promise<void> {
    const url = await getSettleReminderShareUrl(groupId);
    const shareText = url ? `${message}\n${url}` : message;
    void logMonetizationEvent(featureKey, 'remind_sent');
    await shareTextMessage(shareText);
}
