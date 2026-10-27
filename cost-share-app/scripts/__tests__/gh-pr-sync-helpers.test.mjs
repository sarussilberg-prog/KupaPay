import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const helpers = path.join(root, 'lib/gh-pr-sync-helpers.sh');

function bashCheck(fn, msg) {
  const script = `source ${JSON.stringify(helpers)}; ${fn} ${JSON.stringify(msg)} && echo yes || echo no`;
  const result = spawnSync('bash', ['-c', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('is_transient_head_ref_error matches GraphQL compare flake (#579)', () => {
  const sample =
    "GraphQL: Could not resolve head ref 'cursor/crash-offline-resilience-427-3132'. (repository.pullRequest.baseRef.compare)";
  assert.equal(bashCheck('is_transient_head_ref_error', sample), 'yes');
});

test('is_transient_head_ref_error rejects merge conflict errors', () => {
  assert.equal(bashCheck('is_transient_head_ref_error', 'merge conflict in file.ts'), 'no');
});
