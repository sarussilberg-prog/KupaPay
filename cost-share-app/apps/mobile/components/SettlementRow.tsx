/**
 * SettlementRow — activity-feed row for a settlement payment.
 * Composes the shared FeedRowCard + FeedRowThumbnail primitives.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settlement } from '@cost-share/shared';
import { FeedRowCard } from './FeedRowCard';
import { FeedRowThumbnail } from './FeedRowThumbnail';
import { useAppLanguage } from '../hooks/useRtlLayout';
import { formatAmountDecimal } from '../lib/currencyDisplay';
import { formatFeedDateTime } from '../lib/formatFeedDateTime';
import { buildSettlementFeedCopy } from '../lib/feedSettlementPerspective';
import { colors } from '../theme';

interface SettlementRowProps {
    settlement: Settlement;
    currentUserId: string;
    fromName: string;
    toName: string;
    // Kept for caller compatibility (FeedItemRow).
    actorName?: string;
    actorAvatarUrl?: string;
    isMine?: boolean;
    onPress: () => void;
}

function SettlementRowBase({
    settlement,
    currentUserId,
    fromName,
    toName,
    onPress,
}: SettlementRowProps) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const timestamp = formatFeedDateTime(
        new Date(settlement.createdAt),
        language,
    );

    const copy = buildSettlementFeedCopy(settlement, currentUserId);
    const title = t(copy.key);
    const meta = `${timestamp} · ${t('activity.settlement')}`;
    const amount = `${settlement.currency} ${formatAmountDecimal(settlement.amount)}`;

    const thumbnail = (
        <FeedRowThumbnail
            iconName="swap-horizontal-outline"
            iconColor={colors.success.DEFAULT}
            iconBgColor="#ecfdf5"
        />
    );

    return (
        <FeedRowCard
            thumbnail={thumbnail}
            title={title}
            meta={meta}
            amount={amount}
            onPress={onPress}
            testID={`settlement-press-${settlement.id}`}
        />
    );
}

export const SettlementRow = React.memo(SettlementRowBase);
