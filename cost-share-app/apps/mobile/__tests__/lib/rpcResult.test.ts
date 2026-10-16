import { parseRpcResult } from '../../lib/rpcResult';

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
