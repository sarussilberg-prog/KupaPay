import { simplifyDebts } from '../calculations/simplifyDebts';
import { formatMoney } from '../i18n/formatMoney';
import type { Language } from '../i18n/languages';
import type { UserBalance } from '../types';
import {
    interpolateCopy,
    publicGroupPageCopyFor,
    type PublicGroupPageCopy,
} from './publicGroupPageCopy';
import type {
    PublicGroupBalancePageWire,
    PublicGroupDebtRow,
    PublicGroupPageViewModel,
} from './types';

function memberLabel(
    copy: PublicGroupPageCopy,
    displayName: string | null | undefined,
    redacted: boolean,
    isFormer: boolean,
): string {
    if (redacted) return copy.deletedUser;
    if (isFormer) return copy.formerMember;
    const trimmed = displayName?.trim();
    return trimmed || copy.unknownUser;
}

export function buildPublicGroupViewModel(
    wire: PublicGroupBalancePageWire,
    locale: Language,
): PublicGroupPageViewModel | null {
    if (!wire.ok || !wire.group || !wire.members) return null;

    const copy = publicGroupPageCopyFor(locale);
    const memberNameByKey = new Map<string, string>();
    for (const m of wire.members) {
        memberNameByKey.set(
            m.member_key,
            memberLabel(copy, m.display_name, m.redacted, m.is_former === true),
        );
    }

    const debtsByCurrency: PublicGroupDebtRow[][] = [];
    for (const block of wire.balances_by_currency ?? []) {
        const balances: UserBalance[] = block.nets.map(n => ({
            groupId: '',
            userId: n.member_key,
            currency: block.currency,
            totalPaid: 0,
            totalOwed: 0,
            totalSettledPaid: 0,
            totalSettledReceived: 0,
            netBalance: Number(n.net),
        }));
        if (balances.length === 0) continue;
        try {
            const simplified = simplifyDebts(balances, memberNameByKey);
            if (simplified.debts.length === 0) continue;
            debtsByCurrency.push(
                simplified.debts.map(d => ({
                    fromName: d.fromUserName,
                    toName: d.toUserName,
                    amount: d.amount,
                    currency: d.currency,
                })),
            );
        } catch {
            continue;
        }
    }

    const recentExpenses = (wire.recent_expenses ?? []).map(exp => {
        const paidBy = exp.paid_by_redacted
            ? copy.deletedUser
            : memberLabel(copy, exp.paid_by_name, false, false);
        const description = exp.description?.trim() || copy.noExpenses;
        return {
            description,
            amountLabel: formatMoney(exp.amount, exp.currency, { language: locale }),
            dateLabel: exp.expense_date,
            paidByLabel: interpolateCopy(copy.paidBy, { name: paidBy }),
        };
    });

    const debtCount = debtsByCurrency.reduce((n, rows) => n + rows.length, 0);
    const ogDescription =
        debtCount > 0
            ? `${wire.group.name} — ${copy.balancesHeading}`
            : `${wire.group.name} — ${copy.allSettled}`;

    return {
        groupName: wire.group.name,
        defaultCurrency: wire.group.default_currency,
        memberNameByKey,
        debtsByCurrency,
        recentExpenses,
        ogDescription,
    };
}
