import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(
  join(repoRoot, '.github/workflows/device-farm-real-devices.yml'),
  'utf8',
);

test('device-farm-real-devices.yml is workflow_dispatch only', () => {
  assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.doesNotMatch(workflow, /^\s*pull_request:/m);
});

test('device-farm job gated on DEVICE_FARM_ENABLED repository variable', () => {
  assert.match(workflow, /if:\s*vars\.DEVICE_FARM_ENABLED == 'true'/);
});

test('device-farm script documents Maestro smoke flows', () => {
  const sh = readFileSync(
    join(repoRoot, 'cost-share-app/apps/mobile/scripts/ci-device-farm-maestro.sh'),
    'utf8',
  );
  assert.match(sh, /devicefarm create-upload/);
  assert.match(sh, /devicefarm schedule-run/);
});
