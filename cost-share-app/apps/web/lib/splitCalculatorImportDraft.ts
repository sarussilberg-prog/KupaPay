import type { SplitCalculatorExpense, SplitCalculatorParticipant } from './splitCalculatorLogic';

export const SPLIT_CALCULATOR_IMPORT_DRAFT_KEY = 'kupapay.split_calculator.import_draft.v1';
const SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY =
    'kupapay.split_calculator.post_login_return.v1';

export const SPLIT_CALCULATOR_RESUME_IMPORT_QUERY = 'resumeSplitImport';

export type SplitCalculatorImportDraft = {
    groupName: string;
    selfParticipantId: string;
    currency: string;
    participants: SplitCalculatorParticipant[];
    expenses: SplitCalculatorExpense[];
};

function isParticipant(value: unknown): value is SplitCalculatorParticipant {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return typeof row.id === 'string' && typeof row.name === 'string';
}

function isExpense(value: unknown): value is SplitCalculatorExpense {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return (
        typeof row.id === 'string' &&
        typeof row.payerId === 'string' &&
        typeof row.amount === 'number' &&
        Array.isArray(row.participantIds) &&
        row.participantIds.every((id) => typeof id === 'string')
    );
}

export function parseSplitCalculatorImportDraft(raw: string | null): SplitCalculatorImportDraft | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as SplitCalculatorImportDraft;
        if (typeof parsed.groupName !== 'string') return null;
        if (typeof parsed.selfParticipantId !== 'string') return null;
        if (typeof parsed.currency !== 'string') return null;
        if (!Array.isArray(parsed.participants) || !parsed.participants.every(isParticipant)) {
            return null;
        }
        if (!Array.isArray(parsed.expenses) || !parsed.expenses.every(isExpense)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function persistSplitCalculatorImportDraft(draft: SplitCalculatorImportDraft): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SPLIT_CALCULATOR_IMPORT_DRAFT_KEY, JSON.stringify(draft));
}

export function loadSplitCalculatorImportDraft(): SplitCalculatorImportDraft | null {
    if (typeof sessionStorage === 'undefined') return null;
    return parseSplitCalculatorImportDraft(
        sessionStorage.getItem(SPLIT_CALCULATOR_IMPORT_DRAFT_KEY),
    );
}

export function clearSplitCalculatorImportDraft(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SPLIT_CALCULATOR_IMPORT_DRAFT_KEY);
}

export function persistSplitCalculatorPostLoginReturn(returnUrl: string): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY, returnUrl);
}
