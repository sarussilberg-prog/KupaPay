import React from 'react';
import type { ConsolidationBatch, Settlement, GroupMemberLite } from '@cost-share/shared';
import { useTranslation } from 'react-i18next';
import { FeedRowCard } from './FeedRowCard';
import { FeedRowThumbnail } from './FeedRowThumbnail';
import { CurrenciesMergedBadge } from './CurrenciesMergedBadge';
import { useAppLanguage } from '../hooks/useRtlLayout';
import { formatAmountDecimal } from '../lib/currencyDisplay';
import { formatFeedDateTime } from '../lib/formatFeedDateTime';
import { settlementFeedTitleKey } from '../lib/feedSettlementPerspective';
import { colors } from '../theme';

interface ConsolidationBatchRowProps {
    batch: ConsolidationBatch;
    settlements: Settlement[];
    currentUserId: string;
    memberMap: Record<string, GroupMemberLite>;
    onPress?: () => void;
}

export function ConsolidationBatchRow({
    batch,
    settlements,
    currentUserId,
    memberMap: _memberMap,
    onPress,
}: ConsolidationBatchRowProps) {
    const { t } = useTranslation();
    const language = useAppLanguage();

    const fromUserId = batch.paidByUserId;
    const toUserId = batch.paidToUserId
        ?? (settlements.length > 0
            ? (settlements[0].fromUserId === fromUserId
                ? settlements[0].toUserId
                : settlements[0].fromUserId)
            : undefined);

    const perspective = fromUserId === currentUserId ? 'youPaid'
        : toUserId === currentUserId ? 'paidYou'
        : 'thirdParty';

    const currencyCount = new Set(settlements.map(s => s.currency)).size;
    const count = (batch.settlementCount && batch.settlementCount > 0)
        ? batch.settlementCount
        : (currencyCount > 0 ? currencyCount : settlements.length);

    const timestamp = formatFeedDateTime(new Date(batch.createdAt), language);
    const amountText = `${batch.paymentCurrency} ${formatAmountDecimal(batch.paymentAmount)}`;

    const badge = <CurrenciesMergedBadge count={count} />;

    return (
        <FeedRowCard
            thumbnail={
                <FeedRowThumbnail
                    iconName="swap-horizontal-outline"
                    iconColor={colors.success.DEFAULT}
                    iconBgColor="#ecfdf5"
                />
            }
            title={t(settlementFeedTitleKey(perspective))}
            meta={timestamp}
            amount={amountText}
            subLine={badge}
            onPress={onPress}
            testID={`consolidation-batch-row-${batch.id}`}
        />
    );
}
