import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowDir = join(repoRoot, '.github/workflows');
const maestroWorkflows = [
  'mobile-device-ui-maestro.yml',
  'mobile-groups-layout-diagnostics.yml',
];

/** @param {string} yaml */
function jobLevelEnvLinesWithRunnerTemp(yaml) {
  return yaml
    .split('\n')
    .filter((line) => /^\s{6}\S+:\s*\$\{\{\s*runner\.temp/.test(line));
}

for (const name of maestroWorkflows) {
  test(`${name} avoids runner.temp in job-level env (GitHub rejects it)`, () => {
    const text = readFileSync(join(workflowDir, name), 'utf8');
    const bad = jobLevelEnvLinesWithRunnerTemp(text);
    assert.equal(
      bad.length,
      0,
      `Use /tmp/… staging paths instead of runner.temp in job env:\n${bad.join('\n')}`,
    );
  });

  test(`${name} does not configure broken iOS ccache CC wrappers`, () => {
    const text = readFileSync(join(workflowDir, name), 'utf8');
    assert.ok(!text.includes('Setup ccache'), 'remove Setup ccache step');
    assert.ok(!text.includes('Cache ccache'), 'remove Cache ccache step');
    assert.ok(!text.includes('CC="ccache clang"'), 'do not set CC to ccache clang');
  });
}

test('Android build jobs disable Sentry upload when CI has no auth token', () => {
  for (const name of maestroWorkflows) {
    const text = readFileSync(join(workflowDir, name), 'utf8');
    const androidBuild = text.match(/build-android:[\s\S]*?(?=\n  \w|$)/);
    assert.ok(androidBuild, `${name} should define build-android job`);
    assert.match(
      androidBuild[0],
      /SENTRY_DISABLE_AUTO_UPLOAD:\s*'true'/,
      `${name} build-android must set SENTRY_DISABLE_AUTO_UPLOAD`,
    );
  }
});

test('Maestro workflows pass actionlint when installed', () => {
  const actionlint = process.env.ACTIONLINT_PATH || '/tmp/actionlint';
  if (!existsSync(actionlint)) {
    return;
  }
  for (const name of maestroWorkflows) {
    const result = spawnSync(actionlint, [join(workflowDir, name)], {
      encoding: 'utf8',
    });
    assert.equal(
      result.status,
      0,
      `${name} actionlint:\n${result.stdout}\n${result.stderr}`,
    );
  }
});
