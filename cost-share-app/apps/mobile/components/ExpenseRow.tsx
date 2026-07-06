/**
 * ExpenseRow — activity-feed row for an expense.
 * Composes the shared FeedRowCard + FeedRowThumbnail primitives.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ExpenseCategory, ExpenseWithDelta } from '@cost-share/shared';
import {
    FeedRowCard,
    FeedAmountLine,
    FeedInvolvementLabel,
} from './FeedRowCard';
import { FeedRowThumbnail } from './FeedRowThumbnail';
import { AppIconName } from './AppIcon';
import { useAppLanguage } from '../hooks/useRtlLayout';
import { formatAmountDecimal } from '../lib/currencyDisplay';
import { formatFeedDateTime } from '../lib/formatFeedDateTime';
import {
    resolveExpenseFeedPerspective,
    expenseFeedSummaryKey,
    expenseFeedSummaryCount,
} from '../lib/feedExpensePerspective';
import { viewerAmountToneClass } from '../lib/viewerAmountTone';

// ExpenseCategory → Ionicon for the icon-thumbnail fallback.
const CATEGORY_ICON: Record<ExpenseCategory, AppIconName> = {
    food: 'restaurant-outline',
    transport: 'car-outline',
    accommodation: 'bed-outline',
    utilities: 'flash-outline',
    entertainment: 'film-outline',
    shopping: 'cart-outline',
    healthcare: 'medkit-outline',
    other: 'pricetag-outline',
};

interface ExpenseRowProps {
    expense: ExpenseWithDelta;
    currentUserId: string;
    payerName: string;
    // Kept for caller compatibility (FeedItemRow).
    actorName?: string;
    actorAvatarUrl?: string;
    isMine?: boolean;
    onPress: (id: string) => void;
    searchQuery?: string;
}

function ExpenseRowBase({
    expense,
    currentUserId,
    payerName,
    onPress,
}: ExpenseRowProps) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const timestamp = formatFeedDateTime(new Date(expense.createdAt), language);

    const amount = `${expense.currency} ${formatAmountDecimal(expense.amount)}`;
    const perspective = resolveExpenseFeedPerspective(expense, currentUserId);
    const summaryKey = expenseFeedSummaryKey(perspective.perspective);
    const summary = t(summaryKey, {
        count: expenseFeedSummaryCount(perspective),
    });
    const meta = `${timestamp} · ${summary}`.trim();

    // Involvement sub-line — label + amount on separate lines for stable LTR grid.
    let subLine: React.ReactNode | undefined;
    const userShare = Math.abs(expense.myDelta);
    if (userShare > 0) {
        const formatted = `${expense.currency} ${formatAmountDecimal(userShare)}`;
        const key =
            expense.myDeltaState === 'lent'
                ? 'groups.expense.youLent'
                : 'groups.expense.youBorrowed';
        subLine = (
            <View style={{ width: '100%' }}>
                <FeedInvolvementLabel label={t(key, { amount: '' }).trim()} />
                <FeedAmountLine
                    amount={formatted}
                    className="text-[11px] font-medium text-gray-500"
                    baseFontSize={11}
                />
            </View>
        );
    }

    const thumbnail = (
        <FeedRowThumbnail
            imageUrl={expense.receiptUrl ?? undefined}
            iconName={
                CATEGORY_ICON[expense.category as ExpenseCategory] ??
                CATEGORY_ICON.other
            }
        />
    );

    // Amount color mirrors the borrowed/lent sub-line, which is the canonical
    // viewer direction: lent ⇒ owed (green), borrowed ⇒ owes (red), else black.
    const amountClassName = viewerAmountToneClass(
        expense.myDeltaState === 'lent'
            ? 'positive'
            : expense.myDeltaState === 'borrowed'
              ? 'negative'
              : 'neutral',
    );

    return (
        <FeedRowCard
            thumbnail={thumbnail}
            title={expense.description}
            meta={meta}
            amount={amount}
            amountClassName={amountClassName}
            subLine={subLine}
            onPress={() => onPress(expense.id)}
            testID={`expense-row-${expense.id}`}
        />
    );
}

export const ExpenseRow = React.memo(ExpenseRowBase);
