/**
 * Secondary line under group name: members/type · last updated (when not "just now").
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    bindCountLabelNoBreak,
    formatRelativeTimeShort,
    type GroupWithMembers,
} from '@cost-share/shared';
import { Text } from './AppText';
import { rtlTextClassName, useRtlLayout } from '../hooks/useRtlLayout';
import { toDate } from '../lib/dateUtils';

/** Skip "Updated now" noise on list rows (Splitwise-style). */
export const GROUP_CARD_UPDATED_META_MIN_AGE_MS = 90_000;

const META_SEPARATOR = '\u00A0·\u00A0';

const memberMetaClass = 'text-xs text-gray-500 dark:text-gray-400 leading-4';
const updatedMetaClass = 'text-[10px] text-gray-400 dark:text-gray-500 leading-3';

type Props = {
    group: GroupWithMembers;
    memberCount: number;
    language: string;
    testID?: string;
};

export function GroupCardMetaLine({ group, memberCount, language, testID = 'group-card-meta' }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const memberAlignClass = rtlTextClassName(isRtl, memberMetaClass);
    const updatedAlignClass = rtlTextClassName(isRtl, updatedMetaClass);

    const { memberLabel, updatedLabel } = useMemo(() => {
        const activityAt = group.lastActivityAt ?? group.updatedAt;
        const activityTime = toDate(activityAt).getTime();
        const ageMs = Number.isFinite(activityTime) ? Date.now() - activityTime : Number.NaN;

        const memberRaw =
            memberCount > 0
                ? t('groups.memberCount', { count: memberCount })
                : t(`groups.types.${group.groupType}`);
        const memberLabel = bindCountLabelNoBreak(memberRaw);

        if (!Number.isFinite(ageMs) || ageMs < GROUP_CARD_UPDATED_META_MIN_AGE_MS) {
            return { memberLabel, updatedLabel: null as string | null };
        }

        const when = formatRelativeTimeShort(activityAt, Date.now(), language);
        if (!when) return { memberLabel, updatedLabel: null };

        const updatedLabel = t('groups.card.updatedAgo', { when });
        return { memberLabel, updatedLabel };
    }, [
        group.groupType,
        group.lastActivityAt,
        group.updatedAt,
        language,
        memberCount,
        t,
    ]);

    return (
        <View testID={testID} style={{ minWidth: 0, alignSelf: 'stretch' }}>
            <Text className={memberAlignClass} style={{ flexShrink: 1 }} numberOfLines={1}>
                <Text className={memberAlignClass}>{memberLabel}</Text>
                {updatedLabel ? (
                    <>
                        <Text className={updatedMetaClass}>{META_SEPARATOR}</Text>
                        <Text className={updatedAlignClass}>{updatedLabel}</Text>
                    </>
                ) : null}
            </Text>
        </View>
    );
}
