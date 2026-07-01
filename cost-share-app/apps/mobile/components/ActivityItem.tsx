/**
 * ActivityItem — one row in the activity feed.
 *
 * Receives the ActivityEvent plus pre-resolved actor profile and group name.
 * The screen-level component fetches profile/group lookups in batch and passes
 * them down so this component stays display-only.
 */

import React, { useMemo } from 'react';
import type { ActivityEvent, GroupMemberLite } from '@cost-share/shared';
import { useTranslation } from 'react-i18next';
import { MemberAvatar } from './MemberAvatar';
import { FeedChatRow } from './FeedChatRow';
import { ActivityItemCard, resolveActivityTitle } from './ActivityItemCard';
import { formatFeedDateTime } from '../lib/formatFeedDateTime';
import { useAppLanguage } from '../hooks/useRtlLayout';
import {
    getAvatarUrlForMember,
    getDisplayNameForMember,
} from '../lib/userDisplay';
import { formatAmountDecimal } from '../lib/currencyDisplay';

interface ActivityItemProps {
    event: ActivityEvent;
    actor?: GroupMemberLite;
    /** For settlements: profiles of from_user_id / to_user_id (in metadata). */
    counterpart?: GroupMemberLite;
    /** For group_member_joined: profile of the new member from metadata.new_member_user_id. */
    newMember?: GroupMemberLite;
    /** Current user's profile — the avatar for self-actions (invite-link self-join / self-leave) that store no actor. */
    selfProfile?: GroupMemberLite;
    groupName?: string;
    currentUserId: string;
    onPress?: (event: ActivityEvent) => void;
}

export const ActivityItem = React.memo(function ActivityItem({
    event,
    actor,
    counterpart,
    newMember,
    selfProfile,
    groupName,
    currentUserId,
    onPress,
}: ActivityItemProps) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const pressable = Boolean(onPress) && event.kind !== 'group_removed';

    const timestamp = formatFeedDateTime(event.createdAt, language);
    // An absent actorUserId means there is no actor at all (e.g. an invite-link
    // self-join or a self-initiated leave), NOT a deleted one. Render it as an
    // empty name so title resolution can substitute "You"/invite-link copy
    // instead of mislabelling the missing actor as a "deleted user".
    const actorName = event.actorUserId
        ? getDisplayNameForMember(actor ?? null, t)
        : '';
    const newMemberName = newMember ? getDisplayNameForMember(newMember, t) : undefined;
    const friendRequestStatus = event.kind === 'friend_request_received'
        ? (((event.metadata?.status as string | undefined) ?? 'pending') as
            'pending' | 'accepted' | 'rejected' | 'cancelled')
        : undefined;

    // Build a perspective-specific description for event kinds that need it.
    let titleOverride: string | undefined;
    if (event.kind === 'consolidation_batch_added') {
        const md = event.metadata ?? {};
        const paidById = md.paid_by_user_id as string | undefined;
        const toUserId = md.paid_to_user_id as string | undefined;
        const paymentAmount = Number(md.payment_amount ?? 0);
        const paymentCurrency = (md.payment_currency as string | undefined) ?? '';
        const amountText = `${formatAmountDecimal(paymentAmount)} ${paymentCurrency}`;
        const fromName = paidById === currentUserId ? t('common.you') : actorName;
        const toName = toUserId === currentUserId
            ? t('common.you')
            : getDisplayNameForMember(counterpart ?? null, t);
        if (paidById === currentUserId) {
            titleOverride = t('activity.youPaid', { name: toName, amount: amountText });
        } else if (toUserId === currentUserId) {
            titleOverride = t('activity.paidYou', { name: fromName, amount: amountText });
        } else {
            titleOverride = t('feed.settlement', { from: fromName, to: toName, amount: amountText });
        }
    }
    if (event.kind === 'settlement_added') {
        const md = event.metadata ?? {};
        const fromId = md.from_user_id as string | undefined;
        const toId = md.to_user_id as string | undefined;
        const amount = Number(md.amount ?? 0);
        const currency = (md.currency as string | undefined) ?? '';
        const fromName = fromId === currentUserId
            ? t('common.you')
            : (fromId === actor?.userId ? actorName : getDisplayNameForMember(counterpart ?? null, t));
        const toName = toId === currentUserId
            ? t('common.you')
            : (toId === actor?.userId ? actorName : getDisplayNameForMember(counterpart ?? null, t));
        const amountText = `${currency} ${amount.toFixed(2)}`;
        if (fromId === currentUserId) {
            titleOverride = t('activity.youPaid', { name: toName, amount: amountText });
        } else if (toId === currentUserId) {
            titleOverride = t('activity.paidYou', { name: fromName, amount: amountText });
        } else {
            titleOverride = t('feed.settlement', { from: fromName, to: toName, amount: amountText });
        }
        if (groupName) {
            titleOverride = `${titleOverride} ${t('activity.inGroup', { group: groupName })}`;
        }
    }

    const title = titleOverride ?? resolveActivityTitle(
        event,
        { actorName, groupName: groupName ?? '', newMemberName, currentUserId },
        t,
    );

    const { meta, isDeleted, isEdited } = useMemo(() => {
        const md = (event.metadata ?? {}) as Record<string, unknown>;
        const isEditableKind =
            event.kind === 'expense_added'
            || event.kind === 'settlement_added'
            || event.kind === 'message_posted'
            || event.kind === 'consolidation_batch_added';
        const deleted = isEditableKind && md.is_deleted === true;
        const edited = isEditableKind && !deleted && md.is_edited === true;
        let metaText: string;
        switch (event.kind) {
            case 'consolidation_batch_added':
                metaText = timestamp;
                break;
            case 'settlement_added':
            case 'friend_request_received':
            case 'group_added':
            case 'group_member_joined':
            case 'group_removed':
            case 'group_created':
            case 'group_deleted':
            case 'group_note_changed':
            case 'settle_up_reminder':
                metaText = timestamp;
                break;
            case 'expense_added':
            case 'message_posted':
            default:
                metaText = `${actorName} · ${timestamp}`;
        }
        return { meta: metaText, isDeleted: deleted, isEdited: edited };
    }, [event.kind, event.metadata, actorName, timestamp]);

    // The avatar shows whoever performed the action. Self-actions (an
    // invite-link self-join or a self-initiated leave) store no actor; the row
    // belongs to the current user, so fall back to their own avatar.
    const avatarMember = event.actorUserId ? (actor ?? null) : (selfProfile ?? null);
    const avatarName = event.actorUserId
        ? actorName
        : (selfProfile ? getDisplayNameForMember(selfProfile, t) : '');

    const avatar = (
        <MemberAvatar
            name={avatarName}
            avatarUrl={getAvatarUrlForMember(avatarMember)}
            size="xs"
            testID="activity-avatar"
        />
    );

    return (
        <FeedChatRow avatar={avatar} testID={`activity-item-${event.id}`}>
            <ActivityItemCard
                event={event}
                friendRequestStatus={friendRequestStatus}
                title={title}
                meta={meta}
                isDeleted={isDeleted}
                isEdited={isEdited}
                groupName={groupName}
                onPress={pressable ? () => onPress?.(event) : undefined}
                testID={`activity-card-${event.id}`}
            />
        </FeedChatRow>
    );
});
