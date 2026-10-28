/** Structured RPC payloads ({ ok, error_code }) returned by selected Supabase functions. */

export type RpcSuccess = { ok: true };
export type RpcFailure = { ok: false; error_code: string };
export type RpcResult = RpcSuccess | RpcFailure;

export function parseRpcResult(data: unknown): RpcResult | null {
    if (!data || typeof data !== 'object') return null;
    const row = data as Record<string, unknown>;
    if (row.ok === true) return { ok: true };
    if (row.ok === false && typeof row.error_code === 'string') {
        return { ok: false, error_code: row.error_code };
    }
    return null;
}

/** Expense RPCs return `{ ok: true, expense: row }` or `{ ok: false, error_code }`. */
export function unwrapExpenseRpcRow(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    const row = data as Record<string, unknown>;
    if (row.ok === true && row.expense && typeof row.expense === 'object') {
        return row.expense as Record<string, unknown>;
    }
    return null;
}

export class RpcStructuredError extends Error {
    readonly errorCode: string;

    constructor(errorCode: string) {
        super(errorCode);
        this.name = 'RpcStructuredError';
        this.errorCode = errorCode;
    }
}

export function assertRpcSuccess(data: unknown): void {
    const parsed = parseRpcResult(data);
    if (parsed && !parsed.ok) {
        throw new RpcStructuredError(parsed.error_code);
    }
}
