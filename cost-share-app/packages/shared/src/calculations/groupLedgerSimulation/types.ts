export type SplitMode = 'equal' | 'percent' | 'amount';

export interface SimExpense {
    id: string;
    paidBy: string;
    amount: number;
    currency: string;
    splitMode: SplitMode;
    isDeleted: boolean;
}

export interface SimSplit {
    expenseId: string;
    userId: string;
    amount: number;
}

export interface SimSettlement {
    id: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    deletedAt: string | null;
}

export interface SimMember {
    userId: string;
    isActive: boolean;
}

export interface PairwiseDebt {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
}

export interface NetByUserCurrency {
    userId: string;
    currency: string;
    net: number;
}

export type SimOpKind =
    | 'add_expense'
    | 'edit_expense'
    | 'delete_expense'
    | 'settlement'
    | 'settle_all'
    | 'member_join'
    | 'member_leave';

export interface SimulationState {
    groupId: string;
    defaultCurrency: string;
    members: SimMember[];
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
    nextExpenseSeq: number;
    nextSettlementSeq: number;
    nextMemberSeq: number;
}

export interface SimulationRunOptions {
    seed: number;
    opCount: number;
    groupId?: string;
    initialMemberCount?: number;
    currencies?: readonly string[];
}

export interface SimulationFailure {
    seed: number;
    opIndex: number;
    opKind: SimOpKind | 'assert';
    message: string;
}
