/**
 * Secondary line under group name: members/type · last updated (when not "just now").
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatRelativeTimeShort, type GroupWithMembers } from '@cost-share/shared';
import { Text } from './AppText';
import { toDate } from '../lib/dateUtils';

/** Skip "Updated now" noise on list rows (Splitwise-style). */
export const GROUP_CARD_UPDATED_META_MIN_AGE_MS = 90_000;

const META_SEPARATOR = '\u00A0·\u00A0';

type Props = {
    group: GroupWithMembers;
    memberCount: number;
    language: string;
    testID?: string;
};

export function GroupCardMetaLine({ group, memberCount, language, testID = 'group-card-meta' }: Props) {
    const { t } = useTranslation();

    const label = useMemo(() => {
        const activityAt = group.lastActivityAt ?? group.updatedAt;
        const activityTime = toDate(activityAt).getTime();
        const ageMs = Number.isFinite(activityTime) ? Date.now() - activityTime : Number.NaN;

        const memberPart =
            memberCount > 0
                ? t('groups.memberCount', { count: memberCount })
                : t(`groups.types.${group.groupType}`);

        if (!Number.isFinite(ageMs) || ageMs < GROUP_CARD_UPDATED_META_MIN_AGE_MS) {
            return memberPart;
        }

        const when = formatRelativeTimeShort(activityAt, Date.now(), language);
        if (!when) return memberPart;

        return `${memberPart}${META_SEPARATOR}${t('groups.card.updatedAgo', { when })}`;
    }, [
        group.groupType,
        group.lastActivityAt,
        group.updatedAt,
        language,
        memberCount,
        t,
    ]);

    return (
        <View testID={testID} style={{ minWidth: 0 }}>
            <Text className="text-xs text-gray-500 leading-4" numberOfLines={2}>
                {label}
            </Text>
        </View>
    );
}
