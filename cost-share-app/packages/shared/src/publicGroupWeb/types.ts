export type PublicGroupMemberWire = {
    member_key: string;
    display_name: string | null;
    redacted: boolean;
    /** Left the group but account is still active (not deleted). */
    is_former?: boolean;
};

export type PublicGroupNetWire = {
    member_key: string;
    net: number;
};

export type PublicGroupCurrencyBalanceWire = {
    currency: string;
    nets: PublicGroupNetWire[];
};

export type PublicGroupExpenseWire = {
    description: string | null;
    amount: number;
    currency: string;
    expense_date: string;
    paid_by_name: string | null;
    paid_by_redacted: boolean;
};

export type PublicGroupBalancePageWire = {
    ok: boolean;
    group?: {
        name: string;
        default_currency: string;
    };
    members?: PublicGroupMemberWire[];
    balances_by_currency?: PublicGroupCurrencyBalanceWire[];
    recent_expenses?: PublicGroupExpenseWire[];
};

export type PublicGroupDebtRow = {
    fromName: string;
    toName: string;
    amount: number;
    currency: string;
};

export type PublicGroupPageViewModel = {
    groupName: string;
    defaultCurrency: string;
    memberNameByKey: Map<string, string>;
    debtsByCurrency: PublicGroupDebtRow[][];
    recentExpenses: {
        description: string;
        amountLabel: string;
        dateLabel: string;
        paidByLabel: string;
    }[];
    ogDescription: string;
};
