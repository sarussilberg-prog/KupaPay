/** Maestro CI planner unit tests (tier + JS-only native skip). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMaestroCi, isJsOnlyMobileChange } from '../lib/maestro-ci-plan.mjs';
import { fullFlowRuns } from '../lib/maestro-screen-flow-map.mjs';

test('planMaestroCi uses smoke tier for dev PR with screen change', () => {
  const plan = planMaestroCi({
    baseRef: 'dev',
    changedFiles: ['cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx'],
  });
  assert.equal(plan.tier, 'smoke');
  assert.equal(plan.runAndroid, false);
  assert.ok(!plan.flowRuns.some((r) => r.file === 'profile-friend-breakdown.yaml'));
  assert.ok(plan.flowRuns.some((r) => r.file === 'visit-main-screens.yaml'));
});

test('planMaestroCi uses full tier for PR to main', () => {
  const plan = planMaestroCi({
    baseRef: 'main',
    changedFiles: ['cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx'],
  });
  assert.equal(plan.tier, 'full');
  assert.equal(plan.runAndroid, true);
  assert.equal(plan.flowRuns.length, fullFlowRuns().length);
});

test('planMaestroCi honors maestro-full label', () => {
  const plan = planMaestroCi({
    baseRef: 'dev',
    prLabels: ['maestro-full'],
    changedFiles: [],
  });
  assert.equal(plan.tier, 'full');
});

test('isJsOnlyMobileChange is true for TSX-only diff', () => {
  assert.equal(
    isJsOnlyMobileChange(['cost-share-app/apps/mobile/screens/profile/ProfileScreen.tsx']),
    true,
  );
});

test('isJsOnlyMobileChange is false when native tree changes', () => {
  assert.equal(
    isJsOnlyMobileChange(['cost-share-app/apps/mobile/ios/Podfile']),
    false,
  );
});
