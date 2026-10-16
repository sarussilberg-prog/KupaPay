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
