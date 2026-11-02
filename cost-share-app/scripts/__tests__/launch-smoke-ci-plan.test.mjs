import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planReleaseLaunchSmoke,
  touchesLaunchSmokeInfra,
  touchesLaunchSmokeNativeOrBoot,
} from '../lib/launch-smoke-ci-plan.mjs';

test('dev JS-only change skips launch smoke', () => {
  const plan = planReleaseLaunchSmoke({
    baseRef: 'dev',
    changedFiles: ['cost-share-app/apps/mobile/screens/profile/SettingsScreen.tsx'],
  });
  assert.equal(plan.runLaunchSmoke, false);
});

test('dev native touch runs launch smoke', () => {
  assert.equal(
    touchesLaunchSmokeNativeOrBoot(['cost-share-app/apps/mobile/ios/Podfile']),
    true,
  );
  const plan = planReleaseLaunchSmoke({
    baseRef: 'dev',
    changedFiles: ['cost-share-app/apps/mobile/ios/Podfile'],
  });
  assert.equal(plan.runLaunchSmoke, true);
});

test('dev boot entry change runs launch smoke', () => {
  const plan = planReleaseLaunchSmoke({
    baseRef: 'dev',
    changedFiles: ['cost-share-app/apps/mobile/App.tsx'],
  });
  assert.equal(plan.runLaunchSmoke, true);
});

test('main push always runs launch smoke', () => {
  const plan = planReleaseLaunchSmoke({
    baseRef: 'main',
    isPushMain: true,
    changedFiles: ['cost-share-app/apps/mobile/components/Foo.tsx'],
  });
  assert.equal(plan.runLaunchSmoke, true);
});

test('full tier runs launch smoke on dev paths', () => {
  const plan = planReleaseLaunchSmoke({
    baseRef: 'dev',
    tier: 'full',
    changedFiles: ['cost-share-app/apps/mobile/components/Foo.tsx'],
  });
  assert.equal(plan.runLaunchSmoke, true);
  assert.equal(plan.runLaunchSmokeIos, true);
  assert.equal(plan.runLaunchSmokeAndroid, true);
});

test('dev infra-only change runs launch smoke on both platforms', () => {
  assert.equal(
    touchesLaunchSmokeInfra([
      'cost-share-app/apps/mobile/scripts/ci-release-launch-smoke.sh',
    ]),
    true,
  );
  const plan = planReleaseLaunchSmoke({
    baseRef: 'dev',
    changedFiles: ['cost-share-app/apps/mobile/scripts/ci-release-launch-smoke.sh'],
  });
  assert.equal(plan.runLaunchSmoke, true);
  assert.equal(plan.runLaunchSmokeAndroid, true);
});

test('launch-smoke label forces smoke on dev JS-only PR', () => {
  const plan = planReleaseLaunchSmoke({
    baseRef: 'dev',
    prLabels: ['launch-smoke'],
    changedFiles: ['cost-share-app/apps/mobile/screens/Foo.tsx'],
  });
  assert.equal(plan.runLaunchSmoke, true);
});
