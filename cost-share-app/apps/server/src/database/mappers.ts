import {
    User,
    Group,
    GroupMember,
    Expense,
    ExpenseSplit,
    Settlement,
} from '@cost-share/shared';

type Row = Record<string, any>;

const toDate = (v: any): Date => (v instanceof Date ? v : new Date(v));

export const profileFromRow = (r: Row): User => ({
    id: r.id,
    name: r.name,
    email: r.email ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    phone: r.phone ?? undefined,
    defaultCurrency: r.default_currency,
    language: r.language,
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
});

export const groupFromRow = (r: Row): Group => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    imageUrl: r.image_url ?? undefined,
    groupType: r.group_type,
    defaultCurrency: r.default_currency,
    createdBy: r.created_by,
    isActive: r.is_active,
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
});

export const groupMemberFromRow = (r: Row): GroupMember => ({
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    joinedAt: toDate(r.joined_at),
    leftAt: r.left_at ? toDate(r.left_at) : undefined,
    isActive: r.is_active,
});

export const expenseFromRow = (r: Row): Expense => ({
    id: r.id,
    groupId: r.group_id,
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    category: r.category ?? undefined,
    expenseDate: toDate(r.expense_date),
    receiptUrl: r.receipt_url ?? undefined,
    paidBy: r.paid_by,
    createdBy: r.created_by,
    isDeleted: r.is_deleted,
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
});

export const expenseSplitFromRow = (r: Row): ExpenseSplit => ({
    id: r.id,
    expenseId: r.expense_id,
    userId: r.user_id,
    amount: Number(r.amount),
    createdAt: toDate(r.created_at),
});

export const settlementFromRow = (r: Row): Settlement => ({
    id: r.id,
    groupId: r.group_id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    amount: Number(r.amount),
    currency: r.currency,
    settlementDate: toDate(r.settlement_date),
    paymentMethod: r.payment_method ?? undefined,
    createdBy: r.created_by,
    createdAt: toDate(r.created_at),
});
