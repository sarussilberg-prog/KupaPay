export type SplitwiseSkipReason =
    | 'total_balance_row'
    | 'payment_row'
    | 'zero_cost'
    | 'invalid_cost'
    | 'invalid_currency'
    | 'no_participants'
    | 'missing_payer'
    | 'unbalanced_row'
    | 'column_mismatch'
    | 'invalid_date';

export type SplitwiseSkippedRow = {
    lineNumber: number;
    reason: SplitwiseSkipReason;
    description?: string;
};

export type SplitwiseParsedExpense = {
    lineNumber: number;
    expenseDate: string;
    description: string;
    category: string | null;
    amount: number;
    currency: string;
    payerMemberName: string;
    splits: { memberName: string; amount: number }[];
};

export type SplitwiseParseSuccess = {
    ok: true;
    members: string[];
    expenses: SplitwiseParsedExpense[];
    skipped: SplitwiseSkippedRow[];
    defaultCurrency: string;
};

export type SplitwiseParseFailure = {
    ok: false;
    error: 'empty_file' | 'missing_required_columns' | 'no_member_columns';
};

export type SplitwiseParseResult = SplitwiseParseSuccess | SplitwiseParseFailure;

export type SplitwiseMemberMapping = {
    /** Splitwise column name for the signed-in user. */
    selfMemberName: string;
    /** Display names for guest members (all members except self). */
    guestDisplayNames: Record<string, string>;
};

export type SplitwiseImportExpenseDraft = {
    description: string;
    amount: number;
    currency: string;
    category: string | null;
    expenseDate: string;
    paidBy: string;
    splitMode: 'amount';
    splits: { userId: string; amount: number }[];
};
