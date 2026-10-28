import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicGroupPageOutcome } from '../lib/publicGroupPageOutcome.ts';

test('resolvePublicGroupPageOutcome treats RPC errors as not found', () => {
    assert.deepEqual(resolvePublicGroupPageOutcome(new Error('rate limit'), null), {
        kind: 'not_found',
    });
});

test('resolvePublicGroupPageOutcome rejects malformed wire payloads', () => {
    assert.deepEqual(resolvePublicGroupPageOutcome(null, { ok: true, group: { name: 1 } }), {
        kind: 'not_found',
    });
});

test('resolvePublicGroupPageOutcome accepts valid anon-safe wire payloads', () => {
    const data = { ok: true, group: { name: 'Trip', default_currency: 'USD' } };
    const outcome = resolvePublicGroupPageOutcome(null, data);
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind === 'ok') {
        assert.equal(outcome.wire.group.name, 'Trip');
    }
});
