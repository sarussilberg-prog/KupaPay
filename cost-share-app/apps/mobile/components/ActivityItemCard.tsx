/**
 * ActivityItemCard — group-feed-style card with per-kind visual variants.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ActivityEvent } from '@cost-share/shared';
import { Text } from './AppText';
import { FeedRowThumbnail } from './FeedRowThumbnail';
import { CurrenciesMergedBadge } from './CurrenciesMergedBadge';
import { formatCurrencyAmount } from '../lib/currencyDisplay';
import {
    activityCardAmountClassForNet,
    getActivityCardVariant,
} from '../lib/activityCardVariant';
import { useRtlLayout, rtlRowStyle } from '../hooks/useRtlLayout';

interface ResolveTitleArgs {
    actorName: string;
    groupName: string;
    newMemberName?: string;
    currentUserId?: string;
}

export function resolveActivityTitle(
    event: ActivityEvent,
    args: ResolveTitleArgs,
    t: TFunction,
): string {
    const { actorName, groupName, newMemberName, currentUserId } = args;
    const meta = event.metadata ?? {};
    switch (event.kind) {
        case 'expense_added':
            return (meta.description as string | undefined) ?? '';
        case 'settlement_added':
            // Description is built by ActivityItem (it needs perspective + i18n)
            return (meta.description as string | undefined) ?? '';
        case 'message_posted':
            return (meta.body as string | undefined) ?? '';
        case 'friend_request_received': {
            const status = (meta.status as string | undefined) ?? 'pending';
            if (status === 'accepted') {
                return t('activity.notifications.friendRequestAccepted', { name: actorName });
            }
            if (status === 'rejected') {
                const responder = meta.responder_user_id as string | undefined;
                // Rejecter's own row → "You declined {name}'s request".
                // Sender's row (responder is the other person) → "{name} declined your request".
                if (responder && currentUserId && responder === currentUserId) {
                    return t('activity.notifications.friendRequestRejected', { name: actorName });
                }
                return t('activity.notifications.friendRequestRejectedByThem', { name: actorName });
            }
            return t('activity.notifications.friendRequest', { name: actorName });
        }
        case 'group_created':
            return t('activity.notifications.groupCreatedByYou', { group: groupName });
        case 'group_deleted':
            if (event.actorUserId && currentUserId && event.actorUserId === currentUserId) {
                return t('activity.notifications.groupDeletedByYou', { group: groupName });
            }
            return t('activity.notifications.groupDeletedBy', { name: actorName, group: groupName });
        case 'group_note_changed':
            if (event.actorUserId && currentUserId && event.actorUserId === currentUserId) {
                return t('activity.notifications.noteChangedByYou', { group: groupName });
            }
            return t('activity.notifications.noteChangedBy', { name: actorName, group: groupName });
        case 'group_added':
            // No actor → the user joined themselves via an invitation link
            // (redeem_group_invite inserts membership with a NULL added_by).
            // Without an adder there is nobody to name, so never fall through
            // to "{{name}} added you" — that renders the absent actor as a
            // bogus "deleted user".
            if (!actorName) {
                return t('activity.notifications.joinedViaInvite', { group: groupName });
            }
            return t('activity.notifications.groupInvite', { name: actorName, group: groupName });
        case 'group_member_joined': {
            // The viewer is an existing member; when they were the one who added
            // the new member (added_by === them), render the first-person
            // "You added X" instead of the neutral "X joined".
            const addedByUserId = meta.added_by_user_id as string | undefined;
            if (addedByUserId && currentUserId && addedByUserId === currentUserId) {
                return t('activity.notifications.memberAddedByYou', {
                    name: newMemberName ?? actorName,
                });
            }
            return t('activity.notifications.memberJoined', {
                name: newMemberName ?? actorName,
                group: groupName,
            });
        }
        case 'group_removed':
            // An actor means someone else removed this member; name them.
            // No actor → a self-initiated leave, rendered as "You left".
            if (actorName) {
                return t('activity.notifications.memberRemovedYou', {
                    name: actorName,
                    group: groupName,
                });
            }
            return t('activity.notifications.memberLeft', {
                name: t('common.you'),
                group: groupName,
            });
        case 'settle_up_reminder':
            return t('activity.notifications.settleReminder', { name: actorName, group: groupName });
        case 'consolidation_batch_added':
            // Full title is built by ActivityItem (needs perspective)
            return (event.metadata?.description as string | undefined) ?? '';
    }
}

interface ActivityItemCardProps {
    event: ActivityEvent;
    friendRequestStatus?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    title: string;
    meta: string;
    isDeleted?: boolean;
    isEdited?: boolean;
    groupName?: string;
    onPress?: () => void;
    testID?: string;
}

export function ActivityItemCard({
    event,
    friendRequestStatus,
    title,
    meta,
    isDeleted,
    isEdited,
    groupName,
    onPress,
    testID,
}: ActivityItemCardProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const variant = getActivityCardVariant(event.kind, friendRequestStatus);
    const md = event.metadata ?? {};
    const amount = typeof md.amount === 'number' || typeof md.amount === 'string'
        ? Number(md.amount)
        : (typeof md.payment_amount === 'number' || typeof md.payment_amount === 'string'
            ? Number(md.payment_amount) : 0);
    const currency = typeof md.currency === 'string' ? md.currency
        : (typeof md.payment_currency === 'string' ? md.payment_currency : '');
    const showAmount = variant.showAmount && amount > 0 && Boolean(currency);
    const amountText = showAmount ? formatCurrencyAmount(amount, currency) : null;

    // Viewer net for amount color. The feed row belongs to event.userId (the
    // viewer). Expenses carry the viewer's signed net directly in metadata
    // (viewer_delta = paid − share, added by the Task 0 migration); rows created
    // before that migration have no viewer_delta → net 0 → black. Settlements/
    // consolidations carry the parties, so we sign the amount from the viewer's
    // perspective.
    const viewerId = event.userId;
    let amountNet = 0;
    if (event.kind === 'expense_added') {
        amountNet =
            typeof md.viewer_delta === 'number' || typeof md.viewer_delta === 'string'
                ? Number(md.viewer_delta)
                : 0;
    } else if (event.kind === 'settlement_added') {
        if (md.to_user_id === viewerId) amountNet = amount;
        else if (md.from_user_id === viewerId) amountNet = -amount;
    } else if (event.kind === 'consolidation_batch_added') {
        if (md.paid_to_user_id === viewerId) amountNet = amount;
        else if (md.paid_by_user_id === viewerId) amountNet = -amount;
    }
    const amountColorClass = activityCardAmountClassForNet(amountNet);

    const rowStyle = {
        gap: 12,
        alignItems: 'center' as const,
        ...rtlRowStyle(isRtl),
    };

    const shellStyle = {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        width: '100%' as const,
        backgroundColor: variant.backgroundColor,
        borderColor: variant.borderColor,
    };

    const body = (
        <View style={rowStyle}>
            <FeedRowThumbnail
                iconName={variant.iconName}
                iconColor={variant.iconColor}
                iconBgColor={variant.iconBgColor}
                testID="activity-card-thumbnail"
            />
            <View className="flex-1 min-w-0" style={{ gap: 3 }}>
                <Text
                    className="text-[15px] font-semibold text-gray-900 leading-5"
                    numberOfLines={variant.titleLines}
                >
                    {title}
                </Text>
                {groupName && variant.showGroupLine ? (
                    <Text
                        className="text-[12px] font-medium text-primary leading-4"
                        numberOfLines={1}
                    >
                        {groupName}
                    </Text>
                ) : null}
                <Text
                    className="text-[11px] text-gray-400 leading-4"
                    numberOfLines={1}
                >
                    {meta}
                </Text>
            </View>
            {amountText ? (
                <View
                    testID="activity-card-amount"
                    style={{ flexShrink: 0, maxWidth: 108, alignItems: 'flex-end' }}
                >
                    <Text
                        className={`text-[15px] font-bold ${amountColorClass}`}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        style={{ textAlign: 'right' }}
                    >
                        {amountText}
                    </Text>
                    {event.kind === 'consolidation_batch_added' ? (
                        <CurrenciesMergedBadge
                            count={typeof md.settlement_count === 'number' ? md.settlement_count : 0}
                        />
                    ) : null}
                </View>
            ) : null}
        </View>
    );

    const badge = isDeleted ? (
        <View
            testID="activity-badge-deleted"
            style={{
                position: 'absolute',
                top: 8,
                right: 10,
                backgroundColor: '#FEE2E2',
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 2,
            }}
        >
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#DC2626', letterSpacing: 0.2 }}>
                {t('activity.deleted')}
            </Text>
        </View>
    ) : isEdited ? (
        <View
            testID="activity-badge-edited"
            style={{
                position: 'absolute',
                top: 8,
                right: 10,
                backgroundColor: '#F3F4F6',
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 2,
            }}
        >
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#6B7280', letterSpacing: 0.2 }}>
                {t('activity.edited')}
            </Text>
        </View>
    ) : null;

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                testID={testID}
                style={shellStyle}
            >
                {body}
                {badge}
            </TouchableOpacity>
        );
    }

    return (
        <View testID={testID} style={shellStyle}>
            {body}
            {badge}
        </View>
    );
}
