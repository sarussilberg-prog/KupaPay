import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, '..', 'load-test-manifest.json'), 'utf8'),
);
const contract = JSON.parse(
    fs.readFileSync(
        path.join(dir, '..', '..', '..', 'supabase', 'ci', 'schema-contract.snapshot.json'),
        'utf8',
    ),
);

const rpcNames = new Set(contract.functions.map((r) => r.name));

test('manifest RPCs exist in schema contract', () => {
    for (const rpc of manifest.rpcs) {
        assert.ok(rpcNames.has(rpc.name), `missing RPC in contract: ${rpc.name}`);
    }
});

test('retired dashboard RPC is not in active load test list', () => {
    const active = manifest.rpcs.map((r) => r.name);
    assert.ok(!active.includes('get_user_dashboard'));
    assert.ok(active.includes('get_user_simplified_inputs'));
});

test('pass criteria match issue #425', () => {
    assert.equal(manifest.passCriteria.p95RpcMs, 300);
    assert.equal(manifest.passCriteria.maxErrorRate, 0.005);
});
