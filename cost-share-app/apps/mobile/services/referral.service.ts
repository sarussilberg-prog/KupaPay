import { buildInviteUrl } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { shareFriendInvite } from './invite.service';

export type ReferralRewardRow = {
    referee_id: string;
    status: string;
    qualified_at: string | null;
    rewarded_at: string | null;
};

export type ReferralStatus = {
    inviteToken: string;
    rewards: ReferralRewardRow[];
    rewardsThisYear: number;
    annualCap: number;
};

export async function fetchMyReferralStatus(): Promise<ReferralStatus | null> {
    const { data, error } = await supabase.rpc('get_my_referral_status');
    if (error || !data) return null;
    const raw = data as {
        invite_token?: string;
        rewards?: ReferralRewardRow[];
        rewards_this_year?: number;
        annual_cap?: number;
    };
    if (!raw.invite_token) return null;
    return {
        inviteToken: raw.invite_token,
        rewards: raw.rewards ?? [],
        rewardsThisYear: raw.rewards_this_year ?? 0,
        annualCap: raw.annual_cap ?? 12,
    };
}

export function referralInviteUrl(token: string): string {
    return buildInviteUrl('friend', token);
}

export async function shareReferralInvite(): Promise<void> {
    await shareFriendInvite();
}
