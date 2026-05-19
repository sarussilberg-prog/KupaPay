import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { User, Group, Expense } from '@cost-share/shared';

interface AppState {
    // Auth state
    session: Session | null;
    setSession: (session: Session | null) => void;

    // User state
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;

    // Groups state
    groups: Group[];
    setGroups: (groups: Group[]) => void;
    addGroup: (group: Group) => void;
    updateGroup: (group: Group) => void;
    removeGroup: (groupId: string) => void;

    // Expenses state
    expenses: Expense[];
    setExpenses: (expenses: Expense[]) => void;
    addExpense: (expense: Expense) => void;
    updateExpense: (expense: Expense) => void;
    removeExpense: (expenseId: string) => void;

    // Language state
    language: 'en' | 'he';
    setLanguage: (language: 'en' | 'he') => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Auth state
    session: null,
    setSession: (session) =>
        set({
            session,
            currentUser: session
                ? {
                    id: session.user.id,
                    email: session.user.email ?? '',
                    name: session.user.user_metadata?.full_name ?? session.user.email ?? '',
                    avatarUrl: session.user.user_metadata?.avatar_url ?? undefined,
                    defaultCurrency: 'USD',
                    language: 'en' as const,
                    createdAt: new Date(session.user.created_at),
                    updatedAt: new Date(session.user.updated_at ?? session.user.created_at),
                }
                : null,
        }),

    // User state
    currentUser: null,
    setCurrentUser: (user) => set({ currentUser: user }),

    // Groups state
    groups: [],
    setGroups: (groups) => set({ groups }),
    addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
    updateGroup: (group) => set((state) => ({
        groups: state.groups.map((g) => (g.id === group.id ? group : g)),
    })),
    removeGroup: (groupId) => set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
    })),

    // Expenses state
    expenses: [],
    setExpenses: (expenses) => set({ expenses }),
    addExpense: (expense) => set((state) => ({ expenses: [...state.expenses, expense] })),
    updateExpense: (expense) => set((state) => ({
        expenses: state.expenses.map((e) => (e.id === expense.id ? expense : e)),
    })),
    removeExpense: (expenseId) => set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== expenseId),
    })),

    // Language state
    language: 'en',
    setLanguage: (language) => set({ language }),
}));
