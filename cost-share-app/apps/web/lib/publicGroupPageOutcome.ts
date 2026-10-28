import {
    parsePublicGroupBalancePageWire,
    type PublicGroupBalancePageWire,
} from '@cost-share/shared';

export type PublicGroupPageOutcome =
    | { kind: 'not_found' }
    | { kind: 'ok'; wire: PublicGroupBalancePageWire & { ok: true } };

/** Maps Supabase RPC result to a render branch for `/b/<token>` (REQ-GROW-02). */
export function resolvePublicGroupPageOutcome(
    rpcError: unknown,
    rpcData: unknown,
): PublicGroupPageOutcome {
    if (rpcError) {
        return { kind: 'not_found' };
    }
    const wire = parsePublicGroupBalancePageWire(rpcData);
    if (!wire.ok) {
        return { kind: 'not_found' };
    }
    return { kind: 'ok', wire };
}
