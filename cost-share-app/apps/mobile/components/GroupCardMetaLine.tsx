/**
 * Secondary line under group name: members/type · last updated (when not "just now").
 */

import React, { useMemo } from 'react';
import { Platform, View, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    bindCountLabelNoBreak,
    formatRelativeTimeShort,
    type GroupWithMembers,
} from '@cost-share/shared';
import { Text } from './AppText';
import { rtlRowStyle, rtlTextAlign, useRtlLayout } from '../hooks/useRtlLayout';
import { colors } from '../theme';
import { toDate } from '../lib/dateUtils';
import { isAscScreenshotDemo } from '../lib/ascScreenshotDemo';

/** Skip "Updated now" noise on list rows (Splitwise-style). */
export const GROUP_CARD_UPDATED_META_MIN_AGE_MS = 90_000;

const META_SEPARATOR = '\u00A0·\u00A0';

const MEMBER_META_STYLE: TextStyle = {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray500,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
};

const UPDATED_META_STYLE: TextStyle = {
    fontSize: 11,
    lineHeight: 14,
    color: colors.gray400,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
};

type Props = {
    group: GroupWithMembers;
    memberCount: number;
    language: string;
    testID?: string;
};

export function GroupCardMetaLine({ group, memberCount, language, testID = 'group-card-meta' }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const textAlign = rtlTextAlign(isRtl);

    const { memberLabel, updatedWhen } = useMemo(() => {
        const activityAt = group.lastActivityAt ?? group.updatedAt;
        const activityTime = toDate(activityAt).getTime();
        const ageMs = Number.isFinite(activityTime) ? Date.now() - activityTime : Number.NaN;

        const memberRaw =
            memberCount > 0
                ? t('groups.memberCount', { count: memberCount })
                : t(`groups.types.${group.groupType}`);
        const memberLabel = bindCountLabelNoBreak(memberRaw);

        if (isAscScreenshotDemo()) {
            return { memberLabel, updatedWhen: null as string | null };
        }

        if (!Number.isFinite(ageMs) || ageMs < GROUP_CARD_UPDATED_META_MIN_AGE_MS) {
            return { memberLabel, updatedWhen: null as string | null };
        }

        const when = formatRelativeTimeShort(activityAt, Date.now(), language);
        if (!when) return { memberLabel, updatedWhen: null };

        return { memberLabel, updatedWhen: when };
    }, [
        group.groupType,
        group.lastActivityAt,
        group.updatedAt,
        language,
        memberCount,
        t,
    ]);

    return (
        <View
            testID={testID}
            style={[rtlRowStyle(isRtl), { alignItems: 'center', minWidth: 0, flexWrap: 'nowrap' }]}
        >
            <Text
                style={[MEMBER_META_STYLE, { textAlign, flexShrink: 1, minWidth: 0 }]}
                numberOfLines={1}
                testID="group-card-meta-members"
            >
                {memberLabel}
            </Text>
            {updatedWhen ? (
                <>
                    <Text style={[UPDATED_META_STYLE, { flexShrink: 0 }]}>{META_SEPARATOR}</Text>
                    <Text
                        style={[UPDATED_META_STYLE, { textAlign, flexShrink: 0 }]}
                        numberOfLines={1}
                        testID="group-card-meta-updated"
                    >
                        {updatedWhen}
                    </Text>
                </>
            ) : null}
        </View>
    );
}
