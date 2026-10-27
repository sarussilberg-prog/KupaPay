import {
    assertRpcSuccess,
    parseRpcResult,
    RpcStructuredError,
    unwrapExpenseRpcRow,
} from '../../lib/rpcResult';

describe('parseRpcResult', () => {
    it('parses success', () => {
        expect(parseRpcResult({ ok: true })).toEqual({ ok: true });
    });

    it('parses structured failure', () => {
        expect(parseRpcResult({ ok: false, error_code: 'has_balance' })).toEqual({
            ok: false,
            error_code: 'has_balance',
        });
    });

    it('returns null for unexpected payloads', () => {
        expect(parseRpcResult(null)).toBeNull();
        expect(parseRpcResult({ ok: false })).toBeNull();
    });
});

describe('unwrapExpenseRpcRow', () => {
    it('extracts expense row from structured success', () => {
        expect(
            unwrapExpenseRpcRow({ ok: true, expense: { id: 'e1', amount: 10 } }),
        ).toEqual({ id: 'e1', amount: 10 });
    });
});

describe('assertRpcSuccess', () => {
    it('throws RpcStructuredError on failure payload', () => {
        expect(() => assertRpcSuccess({ ok: false, error_code: 'payer_not_group_member' })).toThrow(
            RpcStructuredError,
        );
    });
});
