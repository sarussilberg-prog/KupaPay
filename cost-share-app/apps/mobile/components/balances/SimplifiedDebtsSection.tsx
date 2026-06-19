/**
 * SimplifiedDebtsSection — bottom section of the Balances screen.
 * Reuses the same `DebtRow` as SettleUpListScreen. Debts where the
 * current user is the payer or receiver render directly; the rest are
 * collapsed behind a toggle (same UX as SettleUpListScreen.tsx). The
 * Minimum badge surfaces when every currency was solved exactly, and
 * the "All settled" empty state appears only when every currency
 * simplifies to zero debts.
 */

import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DebtSummary } from '@cost-share/shared';
import { AppIcon } from '../AppIcon';
import { Text } from '../AppText';
import { DebtRow } from './DebtRow';
import type { SimplifiedDebtsByCurrencyEntry } from '../../services/groups.service';
import { resolveDebtPartyName } from '../../lib/userDisplay';
import { colors } from '../../theme';

interface SimplifiedDebtsSectionProps {
    entries: SimplifiedDebtsByCurrencyEntry[];
    avatarById: Record<string, string | undefined>;
    nameById: Record<string, string>;
    currentUserId: string;
    onSettle: (debt: DebtSummary) => void;
}

interface FlatDebt {
    currency: string;
    debt: DebtSummary;
}

export function SimplifiedDebtsSection({
    entries,
    avatarById,
    nameById,
    currentUserId,
    onSettle,
}: SimplifiedDebtsSectionProps) {
    const { t } = useTranslation();
    const [othersExpanded, setOthersExpanded] = useState(false);

    const { totalCount, allExact, involved, others } = useMemo(() => {
        let count = 0;
        let exact = true;
        const inv: FlatDebt[] = [];
        const oth: FlatDebt[] = [];
        for (const e of entries) {
            count += e.result.transactionCount;
            if (e.result.algorithm !== 'exact') exact = false;
            for (const d of e.result.debts) {
                const isMine =
                    d.fromUserId === currentUserId || d.toUserId === currentUserId;
                (isMine ? inv : oth).push({ currency: e.currency, debt: d });
            }
        }
        return { totalCount: count, allExact: exact, involved: inv, others: oth };
    }, [entries, currentUserId]);

    if (involved.length === 0 && others.length === 0) {
        return (
            <View className="bg-green-50 rounded-xl p-6 items-center">
                <Text className="text-base font-medium text-green-700 text-center">
                    {t('balances.allSettled')}
                </Text>
                <Text className="text-sm text-green-600 mt-1 text-center">
                    {t('balances.noDebts')}
                </Text>
            </View>
        );
    }

    const resolveName = (userId: string): string =>
        resolveDebtPartyName(userId, currentUserId, nameById, t);

    const renderRow = ({ currency, debt }: FlatDebt, involvedRow: boolean) => (
        <DebtRow
            key={`${currency}-${debt.fromUserId}-${debt.toUserId}`}
            debt={debt}
            involved={involvedRow}
            fromName={resolveName(debt.fromUserId)}
            toName={resolveName(debt.toUserId)}
            fromAvatar={avatarById[debt.fromUserId]}
            toAvatar={avatarById[debt.toUserId]}
            onPress={() => onSettle(debt)}
        />
    );

    return (
        <View>
            <View
                testID="debts-summary"
                className="flex-row items-center mb-3"
                style={{ gap: 8 }}
            >
                <Text className="text-sm text-gray-500">
                    {t('balances.paymentsToSettle', { count: totalCount })}
                </Text>
                {allExact && (
                    <View
                        testID="minimum-badge"
                        className="bg-emerald-50 rounded-full px-2 py-0.5"
                    >
                        <Text className="text-xs font-medium text-emerald-700">
                            {t('balances.minimumBadge')}
                        </Text>
                    </View>
                )}
            </View>

            {involved.map(item => renderRow(item, true))}

            {others.length > 0 && (
                <View className={involved.length > 0 ? 'mt-2' : 'mt-0'}>
                    <TouchableOpacity
                        onPress={() => setOthersExpanded(v => !v)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        className="flex-row items-center px-3 py-2.5 rounded-2xl bg-slate-100/70 border border-gray-200"
                        testID="settle-others-toggle"
                    >
                        <AppIcon
                            name={othersExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.gray500}
                        />
                        <Text className="ml-2 flex-1 text-[13px] font-medium text-gray-600">
                            {t('settleUp.othersToggle', { count: others.length })}
                        </Text>
                    </TouchableOpacity>
                    {othersExpanded && (
                        <View className="mt-2">
                            {others.map(item => renderRow(item, false))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}
